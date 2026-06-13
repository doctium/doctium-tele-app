import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";
import { CareProgramsService, VitalConfig } from "./care-programs.service";
import { WeatherProvider, WeatherSnapshot } from "./weather.provider";

export interface RiskFactor {
  key: string;
  label: string;
  points: number;
}
export interface RiskResult {
  score: number; // 0–100
  level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  factors: RiskFactor[];
}

interface SignalReading {
  type: string;
  value: number;
  takenAt: Date;
}
interface SignalCrisis {
  startedAt: Date;
  painScore: number;
  hospitalized: boolean;
}

const DAY = 86_400_000;
const NOTIFY_COOLDOWN_MS = 48 * 3_600_000;

/**
 * SCD Phase 4: rules-first, explainable crisis-risk engine + daily care agent.
 *
 * Every point on the score comes from a named, human-readable factor — no
 * black box. Applies to enrollments whose program tracks PAIN (the crisis
 * conditions). The agent sweep persists one assessment per enrollment per day
 * and nudges patient + care lead on HIGH/CRITICAL with a 48h cooldown.
 * Decision support only — it never acts clinically on its own.
 */
@Injectable()
export class RiskService {
  private readonly logger = new Logger("CareRisk");

  constructor(
    private readonly care: CareProgramsService,
    private readonly notifications: NotificationsService,
    private readonly weather: WeatherProvider,
  ) {}

  /** Pure rule engine — deterministic and unit-testable. */
  assess(
    configs: VitalConfig[],
    checkInDays: number,
    readings: SignalReading[],
    crises: SignalCrisis[],
    weather: WeatherSnapshot | null = null,
    now = Date.now(),
  ): RiskResult {
    const factors: RiskFactor[] = [];
    const cfgOf = (t: string) => configs.find((c) => c.type === t);
    const recent = (t: string, days: number) =>
      readings.filter(
        (r) => r.type === t && r.takenAt.getTime() >= now - days * DAY,
      );

    // 1. Crisis recency — risk stays elevated for ~2 weeks after an episode.
    const lastCrisis = crises[0];
    if (lastCrisis) {
      const days = Math.floor((now - lastCrisis.startedAt.getTime()) / DAY);
      if (days <= 14) {
        factors.push({
          key: "crisisRecent",
          points: 30,
          label: `Crisis ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`} — risk stays elevated for about two weeks after an episode`,
        });
      } else if (days <= 30) {
        factors.push({
          key: "crisisRecent",
          points: 15,
          label: `Crisis ${days} days ago`,
        });
      }
    }

    // 2. Pain vs this patient's effective band.
    const painCfg = cfgOf("PAIN");
    if (painCfg) {
      const pains = recent("PAIN", 7);
      const worst = pains.length
        ? Math.max(...pains.map((p) => p.value))
        : null;
      if (
        worst != null &&
        painCfg.criticalMax != null &&
        worst >= painCfg.criticalMax
      ) {
        factors.push({
          key: "painCritical",
          points: 25,
          label: `Pain ${worst}/10 in the last week — at or above the critical level`,
        });
      } else if (painCfg.max != null && pains.length >= 2) {
        const lastThree = pains.slice(-3);
        const avg =
          lastThree.reduce((s, p) => s + p.value, 0) / lastThree.length;
        if (avg > painCfg.max) {
          factors.push({
            key: "painTrend",
            points: 20,
            label: `Recent pain averaging ${Math.round(avg * 10) / 10}/10 — above this patient's target of ${painCfg.max}`,
          });
        }
      }
    }

    // 3. Hydration — the most actionable SCD trigger.
    const hydCfg = cfgOf("HYDRATION");
    if (hydCfg?.min != null) {
      const hyd = recent("HYDRATION", 4);
      const min = hydCfg.min;
      const lowDays = hyd.filter((h) => h.value < min).length;
      if (lowDays >= 2) {
        factors.push({
          key: "hydrationLow",
          points: 20,
          label: `Hydration below ${min} cups on ${lowDays} of the last 4 days — dehydration is the most common crisis trigger`,
        });
      } else if (hyd.length === 0) {
        factors.push({
          key: "hydrationUnknown",
          points: 10,
          label: "No hydration logged in 4 days",
        });
      }
    }

    // 4. Oxygen saturation vs the patient's band.
    const spo2Cfg = cfgOf("SPO2");
    if (spo2Cfg) {
      const sats = recent("SPO2", 3);
      const lowest = sats.length ? Math.min(...sats.map((s) => s.value)) : null;
      if (lowest != null) {
        if (spo2Cfg.criticalMin != null && lowest < spo2Cfg.criticalMin) {
          factors.push({
            key: "spo2Critical",
            points: 25,
            label: `SpO₂ ${lowest}% in the last 3 days — below the critical floor`,
          });
        } else if (spo2Cfg.min != null && lowest < spo2Cfg.min) {
          factors.push({
            key: "spo2Low",
            points: 15,
            label: `SpO₂ ${lowest}% in the last 3 days — below this patient's target`,
          });
        }
      }
    }

    // 5. Engagement — silence means no visibility on early warning signs.
    const quietDays = Math.max(7, 2 * checkInDays);
    const anyRecent = readings.some(
      (r) => r.takenAt.getTime() >= now - quietDays * DAY,
    );
    if (!anyRecent) {
      factors.push({
        key: "quiet",
        points: 10,
        label: `No readings in over ${quietDays} days — early warning signs would be missed`,
      });
    }

    // 6. Environment — live weather for the patient's location when we have it,
    // else a harmattan/dry-season calendar heuristic. Cold exposure and dry
    // air (dehydration) are established sickle-cell crisis triggers.
    if (weather) {
      let pts = 0;
      const bits: string[] = [];
      if (weather.tempC < 18) {
        pts += 12;
        bits.push(`${Math.round(weather.tempC)}°C`);
      } else if (weather.tempC < 23) {
        pts += 7;
        bits.push(`${Math.round(weather.tempC)}°C`);
      }
      if (weather.humidity < 30) {
        pts += 6;
        bits.push(`${Math.round(weather.humidity)}% humidity`);
      }
      if (weather.windKph >= 25) {
        pts += 4;
        bits.push(`${Math.round(weather.windKph)} km/h wind`);
      }
      if (pts > 0) {
        factors.push({
          key: "weather",
          points: Math.min(15, pts),
          label: `Cold/dry weather in your area (${bits.join(", ")}) — cold exposure and dehydration raise crisis risk`,
        });
      }
    } else {
      const month = new Date(now).getMonth();
      if (month >= 10 || month <= 2) {
        factors.push({
          key: "season",
          points: 10,
          label:
            "Harmattan/dry season — cold, dry air and dehydration risk are higher",
        });
      }
    }

    const score = Math.min(
      100,
      factors.reduce((s, f) => s + f.points, 0),
    );
    const level =
      score >= 70
        ? "CRITICAL"
        : score >= 45
          ? "HIGH"
          : score >= 25
            ? "MODERATE"
            : "LOW";
    return { score, level, factors };
  }

  /** True when the program's tracked vitals make the crisis-risk model applicable. */
  private tracksPain(programVitals: unknown): boolean {
    return (
      Array.isArray(programVitals) &&
      programVitals.some(
        (v) => (v as { type?: string } | null)?.type === "PAIN",
      )
    );
  }

  /** Load signals + compute for one enrollment (live — what the UIs show). */
  async computeForEnrollment(enrollmentId: string): Promise<RiskResult | null> {
    const e = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { program: true },
    });
    if (!e || !this.tracksPain(e.program.vitals)) return null;
    return this.computeLoaded(e as never);
  }

  private async computeLoaded(e: {
    id: string;
    userId: string;
    genotype: string | null;
    thresholds: unknown;
    program: { vitals: unknown; genotypeConfig?: unknown; checkInDays: number };
  }): Promise<RiskResult> {
    const configs = this.care.resolveVitalConfigs(
      this.care.genotypeVitals(e.program, e.genotype),
      e.thresholds,
    );
    const checkInDays = this.care.checkInDaysFor(e.program, e.genotype);
    const windowDays = Math.max(14, 2 * checkInDays);
    const [readings, crises, location] = await Promise.all([
      prisma.vitalReading.findMany({
        where: {
          enrollmentId: e.id,
          takenAt: { gte: new Date(Date.now() - windowDays * DAY) },
        },
        select: { type: true, value: true, takenAt: true },
        orderBy: { takenAt: "asc" },
        take: 300,
      }),
      prisma.crisisEvent.findMany({
        where: {
          enrollmentId: e.id,
          startedAt: { gte: new Date(Date.now() - 30 * DAY) },
        },
        select: { startedAt: true, painScore: true, hospitalized: true },
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
      prisma.user.findUnique({
        where: { id: e.userId },
        select: { latitude: true, longitude: true },
      }),
    ]);
    // Cached + no-op-safe: returns null without coords/network → calendar rule.
    const weather = await this.weather.current(
      location?.latitude,
      location?.longitude,
    );
    return this.assess(
      configs,
      checkInDays,
      readings as never,
      crises,
      weather,
    );
  }

  /** Risk + 14-day trend for the enrollment detail screens. */
  async detailRisk(enrollmentId: string) {
    const risk = await this.computeForEnrollment(enrollmentId);
    if (!risk) return { risk: null, riskHistory: [] };
    const riskHistory = await prisma.riskAssessment.findMany({
      where: { enrollmentId },
      select: { score: true, level: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 14,
    });
    return { risk, riskHistory: riskHistory.reverse() };
  }

  /** Lightweight per-enrollment risk for cohort rows. */
  async riskFor(
    enrollmentIds: string[],
  ): Promise<Record<string, { score: number; level: string }>> {
    const out: Record<string, { score: number; level: string }> = {};
    await Promise.all(
      enrollmentIds.map(async (id) => {
        const r = await this.computeForEnrollment(id);
        if (r) out[id] = { score: r.score, level: r.level };
      }),
    );
    return out;
  }

  // ─── Daily care agent ────────────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  runRiskCron() {
    this.runRiskSweep().catch((e) =>
      this.logger.warn(`risk sweep failed: ${(e as Error).message}`),
    );
  }

  /**
   * One assessment per enrollment per day. HIGH/CRITICAL nudges the patient
   * in their preferred language and tells the care lead — max once per 48h.
   */
  async runRiskSweep() {
    const enrollments = await prisma.programEnrollment.findMany({
      where: { status: "ACTIVE" },
      include: { program: true, user: { select: { name: true } } },
      take: 500,
    });
    const applicable = enrollments.filter((e) =>
      this.tracksPain(e.program.vitals),
    );

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    let assessed = 0;
    let notified = 0;
    for (const e of applicable) {
      const already = await prisma.riskAssessment.findFirst({
        where: { enrollmentId: e.id, createdAt: { gte: dayStart } },
        select: { id: true },
      });
      if (already) continue;

      const a = await this.computeLoaded(e as never);
      await prisma.riskAssessment.create({
        data: {
          enrollmentId: e.id,
          userId: e.userId,
          subPatientId: e.subPatientId,
          score: a.score,
          level: a.level,
          factors: a.factors as never,
        },
      });
      assessed++;

      const isHigh = a.level === "HIGH" || a.level === "CRITICAL";
      const cooled =
        e.lastRiskAlertAt &&
        e.lastRiskAlertAt.getTime() > Date.now() - NOTIFY_COOLDOWN_MS;
      if (!isHigh || cooled) continue;

      await prisma.programEnrollment.update({
        where: { id: e.id },
        data: { lastRiskAlertAt: new Date() },
      });
      this.notifications
        .notifyUser(e.userId, {
          key: "care.riskHigh",
          params: { program: e.program.name },
          type: "care_risk",
        })
        .catch(() => {});
      if (e.doctorId) {
        const top = a.factors
          .slice(0, 3)
          .map((f) => f.label)
          .join("; ");
        this.notifications
          .notifyDoctor(e.doctorId, {
            title:
              a.level === "CRITICAL"
                ? "🔴 Critical crisis risk"
                : "🟠 Elevated crisis risk",
            message: `${e.user?.name || "A patient"} (${e.program.name}) — risk ${a.score}/100 (${a.level}). ${top}`,
            type: "care_risk",
          })
          .catch(() => {});
      }
      notified++;
    }
    this.logger.log(`risk sweep: assessed=${assessed} notified=${notified}`);
    return { assessed, notified };
  }

  // ─── Pre-visit brief (the scribe ↔ SCD flywheel) ─────────
  /**
   * Everything the doctor should know before the consult, computed from the
   * patient's care-program data: genotype, live risk + factors, crisis
   * picture, latest vitals, adherence and active goals.
   */
  async buildBrief(doctorId: string, appointmentId: string) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, doctorId: true, userId: true, subPatientId: true },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (appt.doctorId !== doctorId) {
      throw new ForbiddenException("Not your appointment");
    }

    const enrollments = await prisma.programEnrollment.findMany({
      where: {
        userId: appt.userId,
        subPatientId: appt.subPatientId,
        status: "ACTIVE",
      },
      include: { program: true },
      orderBy: { startedAt: "desc" },
    });
    const e = enrollments.find((en) => this.tracksPain(en.program.vitals));
    if (!e) {
      throw new NotFoundException(
        "No active crisis-tracked care program for this patient",
      );
    }

    const since90 = new Date(Date.now() - 90 * DAY);
    const [risk, crises, latestReadings, readings7d, goals] = await Promise.all(
      [
        this.computeLoaded(e as never),
        prisma.crisisEvent.findMany({
          where: { enrollmentId: e.id, startedAt: { gte: since90 } },
          orderBy: { startedAt: "desc" },
          take: 20,
        }),
        prisma.vitalReading.findMany({
          where: { enrollmentId: e.id },
          orderBy: { takenAt: "desc" },
          take: 60,
        }),
        prisma.vitalReading.count({
          where: {
            enrollmentId: e.id,
            takenAt: { gte: new Date(Date.now() - 7 * DAY) },
          },
        }),
        prisma.programGoal.findMany({
          where: { enrollmentId: e.id, status: "ACTIVE" },
          select: { title: true, type: true },
          take: 10,
        }),
      ],
    );

    const latestByType: Record<
      string,
      { value: number; value2: number | null; takenAt: Date }
    > = {};
    for (const r of latestReadings) {
      if (!latestByType[r.type]) {
        latestByType[r.type] = {
          value: r.value,
          value2: r.value2,
          takenAt: r.takenAt,
        };
      }
    }

    const triggerCounts: Record<string, number> = {};
    for (const c of crises) {
      for (const t of Array.isArray(c.triggers) ? c.triggers : []) {
        if (typeof t === "string" && t)
          triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
      }
    }
    const crisisStats = {
      count90d: crises.length,
      hospitalizations90d: crises.filter((c) => c.hospitalized).length,
      topTriggers: Object.entries(triggerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([trigger, count]) => ({ trigger, count })),
    };
    const adherence = this.care.adherenceFor(
      this.care.genotypeVitals(e.program, e.genotype),
      e.thresholds,
      readings7d,
    );

    const summary = [
      e.genotype ? `Genotype ${e.genotype}` : null,
      `Crisis risk ${risk.level} (${risk.score}/100)`,
      `${crisisStats.count90d} crisis${crisisStats.count90d === 1 ? "" : "es"} in 90d`,
      adherence.percent != null ? `adherence ${adherence.percent}%` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      enrollmentId: e.id,
      program: { name: e.program.name, condition: e.program.condition },
      genotype: e.genotype,
      risk,
      crisisStats,
      recentCrises: crises.slice(0, 3),
      latestByType,
      adherence,
      activeGoals: goals,
      summary,
    };
  }
}
