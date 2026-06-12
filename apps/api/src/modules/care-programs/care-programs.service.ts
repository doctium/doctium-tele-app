import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";
import {
  CreateGoalDto,
  CreateProgramDto,
  LogCrisisDto,
  LogReadingDto,
  ResolveCrisisDto,
  UpdateProgramDto,
} from "./dto/care-programs.dto";

/** Display metadata + sanity input bounds per vital (NOT alert thresholds). */
export const VITAL_CATALOG: Record<
  string,
  {
    label: string;
    unit: string;
    min: number;
    max: number;
    hasSecond: boolean;
    lowIsBad: boolean;
  }
> = {
  BLOOD_GLUCOSE: {
    label: "Blood glucose",
    unit: "mg/dL",
    min: 10,
    max: 1000,
    hasSecond: false,
    lowIsBad: true,
  },
  BLOOD_PRESSURE: {
    label: "Blood pressure",
    unit: "mmHg",
    min: 40,
    max: 300,
    hasSecond: true,
    lowIsBad: true,
  },
  WEIGHT: {
    label: "Weight",
    unit: "kg",
    min: 1,
    max: 500,
    hasSecond: false,
    lowIsBad: false,
  },
  SPO2: {
    label: "Oxygen (SpO₂)",
    unit: "%",
    min: 50,
    max: 100,
    hasSecond: false,
    lowIsBad: true,
  },
  PEAK_FLOW: {
    label: "Peak flow",
    unit: "L/min",
    min: 50,
    max: 900,
    hasSecond: false,
    lowIsBad: true,
  },
  MOOD: {
    label: "Mood",
    unit: "/10",
    min: 1,
    max: 10,
    hasSecond: false,
    lowIsBad: true,
  },
  PAIN: {
    label: "Pain",
    unit: "/10",
    min: 0,
    max: 10,
    hasSecond: false,
    lowIsBad: false,
  },
  HYDRATION: {
    label: "Hydration",
    unit: "cups/day",
    min: 0,
    max: 30,
    hasSecond: false,
    lowIsBad: true,
  },
};

/** Per-vital tracking config: program default, overridable per patient. */
export type VitalConfig = {
  type: string;
  cadencePerWeek?: number;
  min?: number;
  max?: number;
  criticalMin?: number;
  criticalMax?: number;
  // second value (diastolic) bounds
  min2?: number;
  max2?: number;
  criticalMin2?: number;
  criticalMax2?: number;
};

const ALERT_COOLDOWN_MS = 12 * 3600_000; // one alert per (enrollment, vital) per 12h

const THRESHOLD_KEYS = [
  "min",
  "max",
  "criticalMin",
  "criticalMax",
  "min2",
  "max2",
  "criticalMin2",
  "criticalMax2",
] as const;

function fmtReading(type: string, value: number, value2?: number | null) {
  const cat = VITAL_CATALOG[type];
  const v =
    cat?.hasSecond && value2 != null ? `${value}/${value2}` : `${value}`;
  return `${v} ${cat?.unit ?? ""}`.trim();
}

/**
 * Chronic Disease Management (Phase 1): data-driven program catalog,
 * enrollment with a supervising care lead, vital-sign logging with
 * threshold evaluation → severity-tiered alerts (12h cooldown per vital),
 * doctor cohort dashboard and admin oversight.
 */
@Injectable()
export class CareProgramsService {
  private readonly logger = new Logger("CarePrograms");

  constructor(private readonly notifications: NotificationsService) {}

  // ─── Threshold evaluation ────────────────────────────────
  /** Program defaults merged with the doctor's per-patient overrides. */
  resolveVitalConfigs(
    programVitals: unknown,
    overrides: unknown,
  ): VitalConfig[] {
    const base = Array.isArray(programVitals)
      ? (programVitals as VitalConfig[])
      : [];
    const ov = (overrides ?? {}) as Record<string, Partial<VitalConfig>>;
    return base
      .filter((v) => v && typeof v.type === "string" && VITAL_CATALOG[v.type])
      .map((v) => ({ ...v, ...(ov[v.type] ?? {}) }));
  }

  /**
   * Genotype protocol layer (SCD Phase 3): the program's base vitals with the
   * patient's genotype overrides merged in by type. Sits BETWEEN program
   * defaults and the care lead's per-patient threshold overrides.
   */
  genotypeVitals(
    program: { vitals: unknown; genotypeConfig?: unknown },
    genotype?: string | null,
  ): unknown {
    const base = Array.isArray(program.vitals)
      ? (program.vitals as VitalConfig[])
      : [];
    const gc = (program.genotypeConfig ?? {}) as Record<
      string,
      { vitals?: VitalConfig[] }
    >;
    const layer = genotype ? gc[genotype]?.vitals : undefined;
    if (!Array.isArray(layer)) return base;
    return base.map((v) => {
      const o = layer.find((l) => l && l.type === v.type);
      return o ? { ...v, ...o } : v;
    });
  }

  /** Check-in cadence with the genotype override applied. */
  checkInDaysFor(
    program: { checkInDays: number; genotypeConfig?: unknown },
    genotype?: string | null,
  ): number {
    const gc = (program.genotypeConfig ?? {}) as Record<
      string,
      { checkInDays?: number }
    >;
    const o = genotype ? gc[genotype]?.checkInDays : undefined;
    return Math.max(
      1,
      (typeof o === "number" && Number.isFinite(o) ? o : 0) ||
        program.checkInDays ||
        7,
    );
  }

  /** Classify one reading against its config. */
  evaluate(
    cfg: VitalConfig,
    value: number,
    value2?: number | null,
  ): { status: "OK" | "WARNING" | "CRITICAL"; message: string } {
    const cat = VITAL_CATALOG[cfg.type];
    const label = cat?.label ?? cfg.type;
    const shown = fmtReading(cfg.type, value, value2);

    const outside = (v: number, min?: number, max?: number) =>
      (min != null && v < min) || (max != null && v > max);

    const critical =
      outside(value, cfg.criticalMin, cfg.criticalMax) ||
      (value2 != null && outside(value2, cfg.criticalMin2, cfg.criticalMax2));
    if (critical) {
      return {
        status: "CRITICAL",
        message: `${label} of ${shown} is well outside the safe range. Please book a consultation now — and if you feel unwell, seek urgent care immediately.`,
      };
    }

    const warning =
      outside(value, cfg.min, cfg.max) ||
      (value2 != null && outside(value2, cfg.min2, cfg.max2));
    if (warning) {
      return {
        status: "WARNING",
        message: `${label} of ${shown} is outside your target range. Keep an eye on it and re-check soon — your care lead has been notified.`,
      };
    }

    return {
      status: "OK",
      message: `${label} of ${shown} is within your target range. Well done!`,
    };
  }

  // ─── Enterprise sponsorship resolution (Phase 3) ─────────
  /** The active sponsorship covering (user, program) with a free seat — or null. */
  async resolveSponsorship(userId: string, programId: string) {
    const memberships = await prisma.orgMember.findMany({
      where: { userId, organization: { status: "ACTIVE" } },
      select: { organizationId: true },
    });
    if (!memberships.length) return null;

    const sponsorships = await prisma.programSponsorship.findMany({
      where: {
        programId,
        isActive: true,
        organizationId: { in: memberships.map((m) => m.organizationId) },
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
      include: { organization: { select: { id: true, name: true } } },
    });
    for (const s of sponsorships) {
      const used = await prisma.programEnrollment.count({
        where: { sponsorshipId: s.id, status: { in: ["ACTIVE", "PAUSED"] } },
      });
      if (used < s.seats) return s;
    }
    return null;
  }

  /** Programs currently covered for this user (drives the app's "sponsored" labels). */
  async sponsoredProgramsFor(userId: string) {
    const memberships = await prisma.orgMember.findMany({
      where: { userId, organization: { status: "ACTIVE" } },
      select: { organizationId: true },
    });
    if (!memberships.length) return [];
    const sponsorships = await prisma.programSponsorship.findMany({
      where: {
        isActive: true,
        organizationId: { in: memberships.map((m) => m.organizationId) },
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
      include: { organization: { select: { name: true } } },
    });
    const out: { programId: string; orgName: string }[] = [];
    for (const s of sponsorships) {
      const used = await prisma.programEnrollment.count({
        where: { sponsorshipId: s.id, status: { in: ["ACTIVE", "PAUSED"] } },
      });
      if (used < s.seats)
        out.push({ programId: s.programId, orgName: s.organization.name });
    }
    return out;
  }

  // ─── Catalog & enrollment (patient) ──────────────────────
  async getCatalog(userId: string) {
    const [programs, mine, sponsored] = await Promise.all([
      prisma.careProgram.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.programEnrollment.findMany({
        // self-enrollments only — family members can join the same program
        where: {
          userId,
          subPatientId: null,
          status: { in: ["ACTIVE", "PAUSED"] },
        },
        select: { programId: true },
      }),
      this.sponsoredProgramsFor(userId),
    ]);
    return {
      programs,
      enrolledProgramIds: mine.map((m) => m.programId),
      sponsoredPrograms: sponsored,
      vitalCatalog: VITAL_CATALOG,
    };
  }

  async enroll(
    userId: string,
    programId: string,
    doctorId?: string,
    subPatientId?: string,
    genotype?: string,
  ) {
    const program = await prisma.careProgram.findUnique({
      where: { id: programId },
    });
    if (!program || !program.isActive)
      throw new NotFoundException("Program not found");

    // Family-member enrollment: the member must belong to this account.
    let member: { id: string; name: string } | null = null;
    if (subPatientId) {
      member = await prisma.subPatient.findFirst({
        where: { id: subPatientId, userId },
        select: { id: true, name: true },
      });
      if (!member) throw new NotFoundException("Family member not found");
    }

    // One live enrollment per (account, program, member) — self and each
    // family member can be in the same program independently.
    const existing = await prisma.programEnrollment.findFirst({
      where: {
        userId,
        programId,
        subPatientId: subPatientId ?? null,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
    });
    if (existing)
      throw new BadRequestException(
        member
          ? `${member.name} is already enrolled in this program`
          : "You're already enrolled in this program",
      );

    // SCD Phase 3: genotype snapshot. An explicit value wins (and backfills
    // the health profile so the EMR learns it too); else read the profile.
    let resolvedGenotype = (genotype ?? "").trim().toUpperCase().slice(0, 4);
    if (resolvedGenotype) {
      const profile = await prisma.healthProfile.findFirst({
        where: { userId, subPatientId: subPatientId ?? null },
        select: { id: true },
      });
      if (profile) {
        await prisma.healthProfile.update({
          where: { id: profile.id },
          data: { genotype: resolvedGenotype },
        });
      } else {
        await prisma.healthProfile.create({
          data: {
            userId,
            subPatientId: subPatientId ?? null,
            genotype: resolvedGenotype,
          },
        });
      }
    } else {
      const profile = await prisma.healthProfile.findFirst({
        where: { userId, subPatientId: subPatientId ?? null },
        select: { genotype: true },
      });
      resolvedGenotype = (profile?.genotype ?? "").trim().toUpperCase();
    }

    // Care lead: explicit choice, else continuity of care — the doctor from
    // the patient's most recent completed consultation.
    let leadId: string | null = null;
    if (doctorId) {
      const doc = await prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { id: true },
      });
      if (!doc) throw new NotFoundException("Doctor not found");
      leadId = doc.id;
    } else {
      const lastConsult = await prisma.appointment.findFirst({
        where: { userId, status: "COMPLETED" },
        orderBy: { date: "desc" },
        select: { doctorId: true },
      });
      leadId = lastConsult?.doctorId ?? null;
    }

    // Enterprise sponsorship first: if an org covers this program for this
    // member and a seat is free, the patient pays nothing (Phase 3).
    let enrollment;
    const sponsorship = await this.resolveSponsorship(userId, programId);
    if (sponsorship) {
      enrollment = await prisma.programEnrollment.create({
        data: {
          userId,
          programId,
          subPatientId: subPatientId ?? null,
          doctorId: leadId,
          genotype: resolvedGenotype,
          sponsorshipId: sponsorship.id,
        },
        include: {
          program: true,
          subPatient: { select: { name: true } },
          sponsorship: {
            select: { organization: { select: { name: true } } },
          },
        },
      });
      this.logger.log(
        `enrollment sponsored by ${sponsorship.organization.name} (${sponsorship.id})`,
      );
    } else if (program.price > 0) {
      // Paid programs: charge the wallet atomically with the enrollment —
      // the balance guard inside the transaction makes overdrafts impossible.
      const wallet = await prisma.userWallet.findUnique({ where: { userId } });
      if (!wallet || wallet.balance < program.price)
        throw new BadRequestException(
          `Insufficient wallet balance — this program costs ${(program.price / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}. Top up your wallet to enroll.`,
        );
      const reference = `care_${programId.slice(-6)}_${userId.slice(-6)}_${Date.now()}`;
      enrollment = await prisma.$transaction(async (tx) => {
        const debited = await tx.userWallet.updateMany({
          where: { userId, balance: { gte: program.price } },
          data: { balance: { decrement: program.price } },
        });
        if (debited.count === 0)
          throw new BadRequestException(
            "Insufficient wallet balance — top up your wallet to enroll.",
          );
        await tx.userWalletHistory.create({
          data: {
            walletId: wallet.id,
            amount: program.price,
            type: "CARE_PROGRAM_PAYMENT",
            description: `${program.name} program enrollment${member ? ` (${member.name})` : ""}`,
          },
        });
        await tx.paymentTransaction.create({
          data: {
            reference,
            type: "CARE_PROGRAM_PAYMENT",
            provider: "WALLET",
            status: "SUCCESS",
            userId,
            amount: program.price,
            channel: "wallet",
          },
        });
        return tx.programEnrollment.create({
          data: {
            userId,
            programId,
            subPatientId: subPatientId ?? null,
            doctorId: leadId,
            genotype: resolvedGenotype,
            paidAmount: program.price,
            paymentRef: reference,
          },
          include: {
            program: true,
            subPatient: { select: { name: true } },
            sponsorship: {
              select: { organization: { select: { name: true } } },
            },
          },
        });
      });
    } else {
      enrollment = await prisma.programEnrollment.create({
        data: {
          userId,
          programId,
          subPatientId: subPatientId ?? null,
          doctorId: leadId,
          genotype: resolvedGenotype,
        },
        include: {
          program: true,
          subPatient: { select: { name: true } },
          sponsorship: {
            select: { organization: { select: { name: true } } },
          },
        },
      });
    }

    if (leadId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const who = member
        ? `${member.name} (family of ${user?.name || "a patient"})`
        : user?.name || "A patient";
      this.notifications
        .notifyDoctor(leadId, {
          title: "New care-program patient",
          message: `${who} enrolled in the ${program.name} program with you as care lead.`,
          type: "care_program_enrollment",
        })
        .catch(() => {});
    }
    this.logger.log(`enrollment ${enrollment.id} created (${program.code})`);
    return enrollment;
  }

  async getMine(userId: string) {
    const enrollments = await prisma.programEnrollment.findMany({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
      include: {
        program: true,
        doctor: {
          select: { id: true, name: true, image: true, designation: true },
        },
        subPatient: { select: { id: true, name: true } },
        sponsorship: { select: { organization: { select: { name: true } } } },
      },
      orderBy: { startedAt: "desc" },
    });
    const ids = enrollments.map((e) => e.id);
    const [readings, openAlerts] = await Promise.all([
      ids.length
        ? prisma.vitalReading.findMany({
            where: { enrollmentId: { in: ids } },
            orderBy: { takenAt: "desc" },
            take: 200,
          })
        : [],
      ids.length
        ? prisma.vitalAlert.groupBy({
            by: ["enrollmentId"],
            where: { enrollmentId: { in: ids }, acknowledgedAt: null },
            _count: { id: true },
          })
        : [],
    ]);
    const alertCount = new Map(
      openAlerts.map((a) => [a.enrollmentId, a._count.id]),
    );

    return {
      vitalCatalog: VITAL_CATALOG,
      enrollments: enrollments.map((e) => {
        const latestByType: Record<
          string,
          { value: number; value2: number | null; takenAt: Date }
        > = {};
        for (const r of readings) {
          if (r.enrollmentId !== e.id) continue;
          if (!latestByType[r.type])
            latestByType[r.type] = {
              value: r.value,
              value2: r.value2,
              takenAt: r.takenAt,
            };
        }
        const readings7d = readings.filter(
          (r) =>
            r.enrollmentId === e.id &&
            r.takenAt.getTime() >= Date.now() - 7 * 86_400_000,
        ).length;
        return {
          ...e,
          latestByType,
          openAlerts: alertCount.get(e.id) ?? 0,
          adherence: this.adherenceFor(
            this.genotypeVitals(e.program, e.genotype),
            e.thresholds,
            readings7d,
          ),
        };
      }),
    };
  }

  // ─── Enrollment detail (patient + care lead + admin) ─────
  async getEnrollmentDetail(
    id: string,
    requester: { sub: string; role: string },
  ) {
    const enrollment = await prisma.programEnrollment.findUnique({
      where: { id },
      include: {
        program: true,
        doctor: {
          select: { id: true, name: true, image: true, designation: true },
        },
        user: { select: { id: true, name: true, image: true } },
        subPatient: { select: { id: true, name: true } },
        sponsorship: { select: { organization: { select: { name: true } } } },
      },
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    const allowed =
      requester.role === "admin" ||
      requester.sub === enrollment.userId ||
      (requester.role === "doctor" && requester.sub === enrollment.doctorId);
    if (!allowed) throw new ForbiddenException("Not your enrollment");

    const since = new Date(Date.now() - 90 * 86_400_000);
    const [readings, alerts, goals, crises] = await Promise.all([
      prisma.vitalReading.findMany({
        where: { enrollmentId: id, takenAt: { gte: since } },
        orderBy: { takenAt: "asc" },
        take: 500,
      }),
      prisma.vitalAlert.findMany({
        where: { enrollmentId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.programGoal.findMany({
        where: { enrollmentId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.crisisEvent.findMany({
        where: { enrollmentId: id },
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
    ]);

    const byType: Record<
      string,
      { value: number; value2: number | null; takenAt: Date; note: string }[]
    > = {};
    for (const r of readings) {
      (byType[r.type] ??= []).push({
        value: r.value,
        value2: r.value2,
        takenAt: r.takenAt,
        note: r.note,
      });
    }
    for (const k of Object.keys(byType))
      byType[k] = (byType[k] ?? []).slice(-60);

    const readings7d = readings.filter(
      (r) => r.takenAt.getTime() >= Date.now() - 7 * 86_400_000,
    ).length;

    const effectiveVitals = this.resolveVitalConfigs(
      this.genotypeVitals(enrollment.program, enrollment.genotype),
      enrollment.thresholds,
    );

    // Crisis stats (90d): the n-of-1 trigger picture for patient + care lead.
    const crises90 = crises.filter((c) => c.startedAt >= since);
    const triggerCounts: Record<string, number> = {};
    for (const c of crises90) {
      for (const t of Array.isArray(c.triggers) ? c.triggers : []) {
        if (typeof t === "string" && t)
          triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
      }
    }
    const resolved = crises90.filter((c) => c.resolvedAt);
    const crisisStats = {
      count90d: crises90.length,
      hospitalizations90d: crises90.filter((c) => c.hospitalized).length,
      avgPain: crises90.length
        ? Math.round(
            (crises90.reduce((s, c) => s + c.painScore, 0) / crises90.length) *
              10,
          ) / 10
        : null,
      avgDurationHours: resolved.length
        ? Math.round(
            resolved.reduce(
              (s, c) =>
                s +
                ((c.resolvedAt as Date).getTime() - c.startedAt.getTime()) /
                  3_600_000,
              0,
            ) / resolved.length,
          )
        : null,
      topTriggers: Object.entries(triggerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([trigger, count]) => ({ trigger, count })),
    };

    return {
      ...enrollment,
      vitals: effectiveVitals,
      vitalCatalog: VITAL_CATALOG,
      readingsByType: byType,
      alerts,
      crises,
      crisisStats,
      goals: goals.map((g) => ({
        ...g,
        progress: this.goalProgress(g, byType[g.type]?.at(-1) ?? null),
      })),
      adherence: this.adherenceFor(
        this.genotypeVitals(enrollment.program, enrollment.genotype),
        enrollment.thresholds,
        readings7d,
      ),
      suggestedThresholds: this.suggestThresholds(effectiveVitals, byType),
    };
  }

  // ─── Vital logging + alert engine ────────────────────────
  async logReading(enrollmentId: string, userId: string, dto: LogReadingDto) {
    const enrollment = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { program: true, user: { select: { name: true } } },
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    if (enrollment.userId !== userId)
      throw new ForbiddenException("Not your enrollment");
    if (enrollment.status !== "ACTIVE")
      throw new BadRequestException("This enrollment is not active");

    const cat = VITAL_CATALOG[dto.type];
    if (!cat) throw new BadRequestException("Unknown vital type");
    const configs = this.resolveVitalConfigs(
      this.genotypeVitals(enrollment.program, enrollment.genotype),
      enrollment.thresholds,
    );
    const cfg = configs.find((c) => c.type === dto.type);
    if (!cfg)
      throw new BadRequestException(
        `${cat.label} is not tracked by this program`,
      );

    if (dto.value < cat.min || dto.value > cat.max)
      throw new BadRequestException(
        `${cat.label} must be between ${cat.min} and ${cat.max} ${cat.unit}`,
      );
    if (cat.hasSecond) {
      if (dto.value2 == null)
        throw new BadRequestException(
          `${cat.label} needs both values (e.g. systolic and diastolic)`,
        );
      if (dto.value2 < cat.min || dto.value2 > cat.max)
        throw new BadRequestException(
          `Second value must be between ${cat.min} and ${cat.max}`,
        );
    }

    const reading = await prisma.vitalReading.create({
      data: {
        userId,
        subPatientId: enrollment.subPatientId,
        enrollmentId,
        type: dto.type as never,
        value: dto.value,
        value2: cat.hasSecond ? dto.value2 : null,
        note: (dto.note ?? "").slice(0, 300),
        takenAt: dto.takenAt ? new Date(dto.takenAt) : new Date(),
      },
    });

    // First reading of this vital becomes the outcome baseline.
    const baseline = (enrollment.baseline ?? {}) as Record<string, unknown>;
    if (!baseline[dto.type]) {
      await prisma.programEnrollment.update({
        where: { id: enrollmentId },
        data: {
          baseline: {
            ...baseline,
            [dto.type]: {
              value: dto.value,
              value2: dto.value2 ?? null,
              at: reading.takenAt,
            },
          } as never,
        },
      });
    }

    const verdict = this.evaluate(
      cfg,
      dto.value,
      cat.hasSecond ? dto.value2 : null,
    );
    let alertCreated = false;

    if (verdict.status !== "OK") {
      // Cooldown: one alert per (enrollment, vital) per 12h — fatigue kills
      // inboxes. A CRITICAL escalation always breaks through a prior WARNING;
      // only a recent CRITICAL suppresses another CRITICAL.
      const recent = await prisma.vitalAlert.findFirst({
        where: {
          enrollmentId,
          type: dto.type as never,
          createdAt: { gte: new Date(Date.now() - ALERT_COOLDOWN_MS) },
          ...(verdict.status === "CRITICAL" ? { severity: "CRITICAL" } : {}),
        },
      });
      if (!recent) {
        await prisma.vitalAlert.create({
          data: {
            enrollmentId,
            readingId: reading.id,
            userId,
            doctorId: enrollment.doctorId,
            type: dto.type as never,
            severity: verdict.status,
            message: `${enrollment.user?.name || "Patient"} · ${enrollment.program.name}: ${cat.label} ${fmtReading(dto.type, dto.value, dto.value2)}`,
          },
        });
        alertCreated = true;
        if (enrollment.doctorId) {
          this.notifications
            .notifyDoctor(enrollment.doctorId, {
              title:
                verdict.status === "CRITICAL"
                  ? "🔴 Critical vital reading"
                  : "🟠 Out-of-range vital reading",
              message: `${enrollment.user?.name || "A patient"} (${enrollment.program.name}) logged ${cat.label.toLowerCase()} of ${fmtReading(dto.type, dto.value, dto.value2)}.`,
              type: "vital_alert",
            })
            .catch(() => {});
        }
        if (verdict.status === "CRITICAL") {
          this.notifications
            .notifyUser(userId, {
              key: "care.vitalAlert",
              params: {
                category: cat.label.toLowerCase(),
                reading: fmtReading(dto.type, dto.value, dto.value2),
              },
              type: "vital_alert",
            })
            .catch(() => {});
        }
      }
    }

    // A reading that meets an active goal flips it to ACHIEVED instantly.
    const achievedGoals = await this.checkGoalsOnReading(
      enrollment.id,
      enrollment.doctorId,
      userId,
      enrollment.user?.name ?? "",
      enrollment.program.name,
      dto.type,
      dto.value,
      cat.hasSecond ? (dto.value2 ?? null) : null,
    );

    return {
      reading,
      status: verdict.status,
      message: verdict.message,
      alertCreated,
      achievedGoals,
    };
  }

  async withdraw(enrollmentId: string, userId: string) {
    const enrollment = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    if (enrollment.userId !== userId)
      throw new ForbiddenException("Not your enrollment");
    if (enrollment.status === "WITHDRAWN") return enrollment;
    return prisma.programEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "WITHDRAWN", endedAt: new Date() },
    });
  }

  // ─── Crisis diary (SCD Phase 3) ──────────────────────────
  /**
   * Logs a structured crisis episode. Also writes a PAIN reading (so the
   * crisis feeds charts, adherence and the baseline learner) and alerts the
   * care lead directly — a crisis is an explicit grave event, so it bypasses
   * the 12h auto-reading alert cooldown.
   */
  async logCrisis(enrollmentId: string, userId: string, dto: LogCrisisDto) {
    const enrollment = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { program: true, user: { select: { name: true } } },
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    if (enrollment.userId !== userId)
      throw new ForbiddenException("Not your enrollment");
    if (enrollment.status !== "ACTIVE")
      throw new BadRequestException("This enrollment is not active");

    const sanitizeList = (v: unknown, max = 8) =>
      (Array.isArray(v) ? v : [])
        .filter((s): s is string => typeof s === "string" && !!s.trim())
        .map((s) => s.trim().slice(0, 40))
        .slice(0, max);

    const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();
    const resolvedAt = dto.resolvedAt ? new Date(dto.resolvedAt) : null;
    if (resolvedAt && resolvedAt < startedAt)
      throw new BadRequestException(
        "Resolved time can't be before the start time",
      );

    const triggers = sanitizeList(dto.triggers);
    const crisis = await prisma.crisisEvent.create({
      data: {
        enrollmentId,
        userId,
        subPatientId: enrollment.subPatientId,
        painScore: dto.painScore,
        sites: sanitizeList(dto.sites),
        triggers,
        treatment: (dto.treatment ?? "").slice(0, 300),
        hospitalized: !!dto.hospitalized,
        notes: (dto.notes ?? "").slice(0, 500),
        startedAt,
        resolvedAt,
      },
    });

    const reading = await prisma.vitalReading.create({
      data: {
        userId,
        subPatientId: enrollment.subPatientId,
        enrollmentId,
        type: "PAIN" as never,
        value: dto.painScore,
        note: "Crisis episode",
        takenAt: startedAt,
      },
    });

    const severity =
      dto.painScore >= 7 || dto.hospitalized ? "CRITICAL" : "WARNING";
    const who = enrollment.user?.name || "Patient";
    await prisma.vitalAlert.create({
      data: {
        enrollmentId,
        readingId: reading.id,
        userId,
        doctorId: enrollment.doctorId,
        type: "PAIN" as never,
        severity: severity as never,
        message: `${who} · ${enrollment.program.name}: crisis logged — pain ${dto.painScore}/10${dto.hospitalized ? ", hospitalized" : ""}${triggers.length ? ` (triggers: ${triggers.join(", ")})` : ""}`,
      },
    });
    if (enrollment.doctorId) {
      this.notifications
        .notifyDoctor(enrollment.doctorId, {
          title:
            severity === "CRITICAL"
              ? "🔴 Sickle cell crisis logged"
              : "🟠 Crisis episode logged",
          message: `${who} (${enrollment.program.name}) logged a crisis: pain ${dto.painScore}/10${dto.hospitalized ? ", hospitalized" : ""}.`,
          type: "crisis_logged",
        })
        .catch(() => {});
    }
    if (severity === "CRITICAL") {
      this.notifications
        .notifyUser(userId, {
          key: "care.crisisLogged",
          params: { program: enrollment.program.name },
          type: "crisis_logged",
        })
        .catch(() => {});
    }

    return { crisis, severity };
  }

  /** Patient marks a crisis over (or updates what treatment helped). */
  async resolveCrisis(crisisId: string, userId: string, dto: ResolveCrisisDto) {
    const crisis = await prisma.crisisEvent.findUnique({
      where: { id: crisisId },
    });
    if (!crisis) throw new NotFoundException("Crisis entry not found");
    if (crisis.userId !== userId)
      throw new ForbiddenException("Not your entry");
    return prisma.crisisEvent.update({
      where: { id: crisisId },
      data: {
        resolvedAt: crisis.resolvedAt ?? new Date(),
        ...(dto.treatment !== undefined
          ? { treatment: dto.treatment.slice(0, 300) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.slice(0, 500) } : {}),
      },
    });
  }

  // ─── Care lead (doctor) ──────────────────────────────────
  async updateThresholds(
    enrollmentId: string,
    doctorId: string,
    thresholds: Record<string, Record<string, number>>,
  ) {
    const enrollment = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { program: true },
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    if (enrollment.doctorId !== doctorId)
      throw new ForbiddenException("You are not this patient's care lead");

    // Only known vitals + numeric threshold keys survive.
    const clean: Record<string, Record<string, number>> = {};
    for (const [type, cfg] of Object.entries(thresholds ?? {})) {
      if (!VITAL_CATALOG[type] || typeof cfg !== "object" || !cfg) continue;
      const entry: Record<string, number> = {};
      for (const key of THRESHOLD_KEYS) {
        const v = (cfg as Record<string, unknown>)[key];
        if (typeof v === "number" && Number.isFinite(v)) entry[key] = v;
      }
      if (Object.keys(entry).length) clean[type] = entry;
    }

    return prisma.programEnrollment.update({
      where: { id: enrollmentId },
      data: { thresholds: clean },
    });
  }

  async getDoctorCohort(doctorId: string) {
    const enrollments = await prisma.programEnrollment.findMany({
      where: { doctorId, status: "ACTIVE" },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            condition: true,
            icon: true,
            vitals: true,
            genotypeConfig: true,
          },
        },
        user: { select: { id: true, name: true, image: true, mobile: true } },
        subPatient: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: "desc" },
    });
    const ids = enrollments.map((e) => e.id);
    const since7d = new Date(Date.now() - 7 * 86_400_000);
    const [readings, alerts] = await Promise.all([
      ids.length
        ? prisma.vitalReading.findMany({
            where: { enrollmentId: { in: ids } },
            orderBy: { takenAt: "desc" },
            take: 500,
          })
        : [],
      ids.length
        ? prisma.vitalAlert.findMany({
            where: { enrollmentId: { in: ids }, acknowledgedAt: null },
            select: { enrollmentId: true, severity: true },
          })
        : [],
    ]);

    const cohort = enrollments.map((e) => {
      const mine = readings.filter((r) => r.enrollmentId === e.id);
      const latestByType: Record<
        string,
        { value: number; value2: number | null; takenAt: Date }
      > = {};
      for (const r of mine) {
        if (!latestByType[r.type])
          latestByType[r.type] = {
            value: r.value,
            value2: r.value2,
            takenAt: r.takenAt,
          };
      }
      const myAlerts = alerts.filter((a) => a.enrollmentId === e.id);
      const readings7d = mine.filter((r) => r.takenAt >= since7d).length;
      const rag = myAlerts.some((a) => a.severity === "CRITICAL")
        ? "RED"
        : myAlerts.length > 0 || (mine.length > 0 && readings7d === 0)
          ? "AMBER"
          : mine.length === 0
            ? "AMBER" // enrolled but never logged → needs onboarding
            : "GREEN";
      return {
        id: e.id,
        program: e.program,
        user: e.user,
        subPatient: e.subPatient,
        startedAt: e.startedAt,
        latestByType,
        openAlerts: myAlerts.length,
        readings7d,
        adherence: this.adherenceFor(
          this.genotypeVitals(e.program, e.genotype),
          e.thresholds,
          readings7d,
        ),
        rag,
      };
    });

    const order = { RED: 0, AMBER: 1, GREEN: 2 } as Record<string, number>;
    cohort.sort((a, b) => (order[a.rag] ?? 9) - (order[b.rag] ?? 9));
    return { cohort, vitalCatalog: VITAL_CATALOG };
  }

  getDoctorAlerts(doctorId: string, openOnly = true) {
    return prisma.vitalAlert.findMany({
      where: { doctorId, ...(openOnly ? { acknowledgedAt: null } : {}) },
      include: {
        reading: true,
        enrollment: {
          select: {
            id: true,
            program: { select: { name: true } },
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async ackAlert(alertId: string, doctorId: string) {
    const alert = await prisma.vitalAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) throw new NotFoundException("Alert not found");
    if (alert.doctorId !== doctorId)
      throw new ForbiddenException("Not your alert");
    if (alert.acknowledgedAt) return alert;
    return prisma.vitalAlert.update({
      where: { id: alertId },
      data: { acknowledgedAt: new Date(), acknowledgedBy: doctorId },
    });
  }

  // ─── Adherence (Phase 2) ─────────────────────────────────
  /** Expected readings/week from the program's cadences vs what actually landed. */
  adherenceFor(programVitals: unknown, overrides: unknown, readings7d: number) {
    const expectedPerWeek = this.resolveVitalConfigs(
      programVitals,
      overrides,
    ).reduce((s, c) => s + (c.cadencePerWeek ?? 0), 0);
    return {
      expectedPerWeek,
      readings7d,
      percent:
        expectedPerWeek > 0
          ? Math.min(100, Math.round((readings7d / expectedPerWeek) * 100))
          : null,
    };
  }

  // ─── Baseline learner (SCD Phase 3) ──────────────────────
  /**
   * Learns each patient's steady state from their own readings and suggests
   * per-patient WARNING-band overrides for the care lead to apply (one tap →
   * updateThresholds). Deterministic and explainable: the suggested band is
   * the patient's p10–p90, clamped inside the CRITICAL bounds — safety rails
   * are never personalized.
   */
  suggestThresholds(
    configs: VitalConfig[],
    readingsByType: Record<
      string,
      { value: number; value2: number | null; takenAt: Date; note: string }[]
    >,
  ) {
    const MIN_READINGS = 7;
    const out: Record<
      string,
      {
        min?: number;
        max?: number;
        basis: { count: number; median: number; p10: number; p90: number };
        rationale: string;
      }
    > = {};

    for (const cfg of configs) {
      const rs = readingsByType[cfg.type] ?? [];
      if (rs.length < MIN_READINGS) continue;
      const values = rs.map((r) => r.value).sort((a, b) => a - b);
      const q = (p: number) =>
        values[
          Math.min(values.length - 1, Math.round(p * (values.length - 1)))
        ] ?? 0;
      const median = q(0.5);
      const p10 = q(0.1);
      const p90 = q(0.9);

      const entry: { min?: number; max?: number } = {};
      if (cfg.min != null) {
        let s = Math.floor(p10);
        if (cfg.criticalMin != null) s = Math.max(s, cfg.criticalMin + 1);
        if (Math.abs(s - cfg.min) >= 1) entry.min = s;
      }
      if (cfg.max != null) {
        let s = Math.ceil(p90);
        if (cfg.criticalMax != null) s = Math.min(s, cfg.criticalMax - 1);
        if (Math.abs(s - cfg.max) >= 1) entry.max = s;
      }
      if (Object.keys(entry).length === 0) continue;

      const cat = VITAL_CATALOG[cfg.type];
      out[cfg.type] = {
        ...entry,
        basis: { count: values.length, median, p10, p90 },
        rationale:
          `Based on ${values.length} readings: this patient's typical ` +
          `${cat?.label?.toLowerCase() ?? cfg.type} runs ${p10}–${p90} ` +
          `${cat?.unit ?? ""} (median ${median}). The suggested warning band ` +
          `fits their steady state; critical limits are unchanged.`,
      };
    }
    return out;
  }

  // ─── Goals (Phase 2) ─────────────────────────────────────
  private goalMet(
    goal: {
      direction: string;
      targetValue: number;
      targetValue2: number | null;
    },
    value: number,
    value2: number | null,
  ): boolean {
    if (goal.direction === "AT_OR_BELOW") {
      if (value > goal.targetValue) return false;
      if (
        goal.targetValue2 != null &&
        value2 != null &&
        value2 > goal.targetValue2
      )
        return false;
      return true;
    }
    if (value < goal.targetValue) return false;
    if (
      goal.targetValue2 != null &&
      value2 != null &&
      value2 < goal.targetValue2
    )
      return false;
    return true;
  }

  /** 0–100 from startValue → latest toward target (100 once met). */
  goalProgress(
    goal: {
      direction: string;
      targetValue: number;
      targetValue2: number | null;
      startValue: number | null;
      status: string;
    },
    latest: { value: number; value2: number | null } | null,
  ): number | null {
    if (goal.status === "ACHIEVED") return 100;
    if (!latest) return null;
    if (this.goalMet(goal as never, latest.value, latest.value2)) return 100;
    if (goal.startValue == null) return 0;
    const span =
      goal.direction === "AT_OR_BELOW"
        ? goal.startValue - goal.targetValue
        : goal.targetValue - goal.startValue;
    if (span <= 0) return 0;
    const done =
      goal.direction === "AT_OR_BELOW"
        ? goal.startValue - latest.value
        : latest.value - goal.startValue;
    return Math.max(0, Math.min(100, Math.round((done / span) * 100)));
  }

  async createGoal(enrollmentId: string, doctorId: string, dto: CreateGoalDto) {
    const enrollment = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { program: true },
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    if (enrollment.doctorId !== doctorId)
      throw new ForbiddenException("You are not this patient's care lead");
    if (enrollment.status !== "ACTIVE")
      throw new BadRequestException("This enrollment is not active");

    const cat = VITAL_CATALOG[dto.type];
    if (!cat) throw new BadRequestException("Unknown vital type");
    const tracked = this.resolveVitalConfigs(
      this.genotypeVitals(enrollment.program, enrollment.genotype),
      enrollment.thresholds,
    );
    if (!tracked.some((c) => c.type === dto.type))
      throw new BadRequestException(
        `${cat.label} is not tracked by this program`,
      );
    if (dto.direction !== "AT_OR_BELOW" && dto.direction !== "AT_OR_ABOVE")
      throw new BadRequestException(
        "direction must be AT_OR_BELOW or AT_OR_ABOVE",
      );
    if (dto.targetValue < cat.min || dto.targetValue > cat.max)
      throw new BadRequestException(
        `Target must be between ${cat.min} and ${cat.max} ${cat.unit}`,
      );

    const latest = await prisma.vitalReading.findFirst({
      where: { enrollmentId, type: dto.type as never },
      orderBy: { takenAt: "desc" },
    });

    const arrow = dto.direction === "AT_OR_BELOW" ? "≤" : "≥";
    const target = `${dto.targetValue}${dto.targetValue2 != null ? `/${dto.targetValue2}` : ""}`;
    const goal = await prisma.programGoal.create({
      data: {
        enrollmentId,
        userId: enrollment.userId,
        doctorId,
        type: dto.type as never,
        direction: dto.direction,
        targetValue: dto.targetValue,
        targetValue2: cat.hasSecond ? (dto.targetValue2 ?? null) : null,
        title: (
          dto.title ?? `${cat.label} ${arrow} ${target} ${cat.unit}`
        ).slice(0, 120),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        startValue: latest?.value ?? null,
        startValue2: latest?.value2 ?? null,
      },
    });

    this.notifications
      .notifyUser(enrollment.userId, {
        key: "care.newGoal",
        params: {
          goal: goal.title,
          due: goal.dueDate
            ? ` by ${goal.dueDate.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`
            : "",
        },
        type: "care_goal",
      })
      .catch(() => {});
    return goal;
  }

  async cancelGoal(goalId: string, doctorId: string) {
    const goal = await prisma.programGoal.findUnique({
      where: { id: goalId },
      include: { enrollment: { select: { doctorId: true } } },
    });
    if (!goal) throw new NotFoundException("Goal not found");
    if (goal.enrollment.doctorId !== doctorId)
      throw new ForbiddenException("You are not this patient's care lead");
    if (goal.status !== "ACTIVE") return goal;
    return prisma.programGoal.update({
      where: { id: goalId },
      data: { status: "CANCELLED" },
    });
  }

  /** Flip met goals to ACHIEVED when a reading lands; returns the achieved titles. */
  private async checkGoalsOnReading(
    enrollmentId: string,
    doctorId: string | null,
    userId: string,
    userName: string,
    programName: string,
    type: string,
    value: number,
    value2: number | null,
  ): Promise<string[]> {
    const active = await prisma.programGoal.findMany({
      where: { enrollmentId, type: type as never, status: "ACTIVE" },
    });
    const achieved: string[] = [];
    for (const goal of active) {
      if (!this.goalMet(goal, value, value2)) continue;
      await prisma.programGoal.update({
        where: { id: goal.id },
        data: { status: "ACHIEVED", achievedAt: new Date() },
      });
      achieved.push(goal.title);
      this.notifications
        .notifyUser(userId, {
          key: "care.goalAchieved",
          params: { goal: goal.title },
          type: "care_goal_achieved",
        })
        .catch(() => {});
      if (doctorId) {
        this.notifications
          .notifyDoctor(doctorId, {
            title: "Patient goal achieved",
            message: `${userName || "Your patient"} (${programName}) just hit: ${goal.title}.`,
            type: "care_goal_achieved",
          })
          .catch(() => {});
      }
    }
    return achieved;
  }

  // ─── Engagement engine (Phase 2): check-ins + escalation ─
  @Cron(CronExpression.EVERY_HOUR)
  async runEngagementCron() {
    try {
      await this.runEngagement();
    } catch (e) {
      this.logger.warn(`engagement pass failed: ${(e as Error).message}`);
    }
  }

  /** Manual trigger for the admin panel / tests. */
  async runEngagement() {
    const checkIns = await this.processCheckIns();
    const escalations = await this.escalateSilentPatients();
    const { count: goalsMissed } = await prisma.programGoal.updateMany({
      where: { status: "ACTIVE", dueDate: { lt: new Date() } },
      data: { status: "MISSED" },
    });
    if (checkIns.sent || escalations.escalated || goalsMissed)
      this.logger.log(
        `engagement: ${checkIns.sent} check-ins, ${escalations.escalated} escalations, ${goalsMissed} goals missed`,
      );
    return {
      checkInsSent: checkIns.sent,
      checkInsSkipped: checkIns.skipped,
      escalations: escalations.escalated,
      goalsMissed,
    };
  }

  /**
   * Cadence check-ins: every `checkInDays`, nudge the patient to log.
   * Patients who logged within the window get a silent advance — no nag.
   */
  async processCheckIns(): Promise<{ sent: number; skipped: number }> {
    const now = Date.now();
    const enrollments = await prisma.programEnrollment.findMany({
      where: { status: "ACTIVE" },
      include: {
        program: {
          select: { name: true, checkInDays: true, genotypeConfig: true },
        },
      },
      take: 500,
    });
    let sent = 0;
    let skipped = 0;
    for (const e of enrollments) {
      const days = this.checkInDaysFor(e.program, e.genotype);
      const anchor = (e.lastCheckInAt ?? e.startedAt).getTime();
      if (now < anchor + days * 86_400_000) continue;

      const recent = await prisma.vitalReading.findFirst({
        where: {
          enrollmentId: e.id,
          takenAt: { gte: new Date(now - days * 86_400_000) },
        },
        select: { id: true },
      });
      await prisma.programEnrollment.update({
        where: { id: e.id },
        data: { lastCheckInAt: new Date() },
      });
      if (recent) {
        skipped++; // already engaged — advance the clock quietly
        continue;
      }
      this.notifications
        .notifyUser(e.userId, {
          key: "care.checkin",
          params: { program: e.program.name },
          type: "care_checkin",
        })
        .catch(() => {});
      sent++;
    }
    return { sent, skipped };
  }

  /**
   * Patients silent for 2× their cadence (min 7 days) get a stronger nudge and
   * their care lead is told — disengagement is the leading churn signal in
   * chronic care. Re-escalates at most weekly.
   */
  async escalateSilentPatients(): Promise<{ escalated: number }> {
    const now = Date.now();
    const enrollments = await prisma.programEnrollment.findMany({
      where: { status: "ACTIVE" },
      include: {
        program: {
          select: { name: true, checkInDays: true, genotypeConfig: true },
        },
        user: { select: { name: true } },
      },
      take: 500,
    });
    let escalated = 0;
    for (const e of enrollments) {
      const silentDays = Math.max(
        7,
        2 * this.checkInDaysFor(e.program, e.genotype),
      );
      const cutoff = new Date(now - silentDays * 86_400_000);
      if (e.startedAt > cutoff) continue; // too new to judge
      if (
        e.lastEscalationAt &&
        e.lastEscalationAt.getTime() > now - 7 * 86_400_000
      )
        continue;

      const recent = await prisma.vitalReading.findFirst({
        where: { enrollmentId: e.id, takenAt: { gte: cutoff } },
        select: { id: true },
      });
      if (recent) continue;

      await prisma.programEnrollment.update({
        where: { id: e.id },
        data: { lastEscalationAt: new Date() },
      });
      this.notifications
        .notifyUser(e.userId, {
          key: "care.escalation",
          params: { program: e.program.name },
          type: "care_escalation",
        })
        .catch(() => {});
      if (e.doctorId) {
        this.notifications
          .notifyDoctor(e.doctorId, {
            title: "Patient gone quiet",
            message: `${e.user?.name || "A patient"} (${e.program.name}) hasn't logged a reading in over ${silentDays} days. Consider reaching out.`,
            type: "care_escalation",
          })
          .catch(() => {});
      }
      escalated++;
    }
    return { escalated };
  }

  // ─── Admin ───────────────────────────────────────────────
  async adminListPrograms() {
    const programs = await prisma.careProgram.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const counts = await prisma.programEnrollment.groupBy({
      by: ["programId", "status"],
      _count: { id: true },
    });
    return programs.map((p) => ({
      ...p,
      activeEnrollments: counts
        .filter((c) => c.programId === p.id && c.status === "ACTIVE")
        .reduce((s, c) => s + c._count.id, 0),
      totalEnrollments: counts
        .filter((c) => c.programId === p.id)
        .reduce((s, c) => s + c._count.id, 0),
    }));
  }

  createProgram(dto: CreateProgramDto) {
    return prisma.careProgram.create({
      data: {
        code: dto.code,
        name: dto.name,
        condition: dto.condition ?? "",
        description: dto.description ?? "",
        icon: dto.icon ?? "",
        vitals: (dto.vitals ?? []) as never,
        checkInDays: dto.checkInDays ?? 7,
        price: dto.price ?? 0,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateProgram(id: string, dto: UpdateProgramDto) {
    const exists = await prisma.careProgram.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Program not found");
    return prisma.careProgram.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.condition != null ? { condition: dto.condition } : {}),
        ...(dto.description != null ? { description: dto.description } : {}),
        ...(dto.icon != null ? { icon: dto.icon } : {}),
        ...(dto.vitals != null ? { vitals: dto.vitals as never } : {}),
        ...(dto.checkInDays != null ? { checkInDays: dto.checkInDays } : {}),
        ...(dto.price != null ? { price: dto.price } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async adminOverview() {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [activeEnrollments, readings30d, alerts30d, openAlerts, programs] =
      await Promise.all([
        prisma.programEnrollment.count({ where: { status: "ACTIVE" } }),
        prisma.vitalReading.count({ where: { createdAt: { gte: since30 } } }),
        prisma.vitalAlert.groupBy({
          by: ["severity"],
          where: { createdAt: { gte: since30 } },
          _count: { id: true },
        }),
        prisma.vitalAlert.count({ where: { acknowledgedAt: null } }),
        this.adminListPrograms(),
      ]);

    // Outcome signal: first vs latest reading of each program's primary vital,
    // averaged across enrollments with at least 2 readings. The insurer metric.
    const outcomes: {
      programId: string;
      name: string;
      vital: string;
      patients: number;
      avgFirst: number | null;
      avgLatest: number | null;
    }[] = [];
    for (const p of programs) {
      const primary = (
        Array.isArray(p.vitals) ? (p.vitals as VitalConfig[]) : []
      )[0];
      if (!primary?.type) continue;
      const enrollments = await prisma.programEnrollment.findMany({
        where: { programId: p.id, status: "ACTIVE" },
        select: { id: true },
      });
      const firsts: number[] = [];
      const latests: number[] = [];
      for (const e of enrollments) {
        const [first, latest] = await Promise.all([
          prisma.vitalReading.findFirst({
            where: { enrollmentId: e.id, type: primary.type as never },
            orderBy: { takenAt: "asc" },
          }),
          prisma.vitalReading.findFirst({
            where: { enrollmentId: e.id, type: primary.type as never },
            orderBy: { takenAt: "desc" },
          }),
        ]);
        if (first && latest && first.id !== latest.id) {
          firsts.push(first.value);
          latests.push(latest.value);
        }
      }
      const avg = (xs: number[]) =>
        xs.length
          ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10
          : null;
      outcomes.push({
        programId: p.id,
        name: p.name,
        vital: primary.type,
        patients: firsts.length,
        avgFirst: avg(firsts),
        avgLatest: avg(latests),
      });
    }

    const alertCount = (sev: string) =>
      alerts30d.find((a) => a.severity === sev)?._count.id ?? 0;

    // Platform adherence: mean of per-enrollment 7d adherence (Phase 2)
    const active = await prisma.programEnrollment.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        thresholds: true,
        genotype: true,
        program: { select: { vitals: true, genotypeConfig: true } },
      },
      take: 1000,
    });
    const counts7d = active.length
      ? await prisma.vitalReading.groupBy({
          by: ["enrollmentId"],
          where: {
            enrollmentId: { in: active.map((e) => e.id) },
            takenAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
          },
          _count: { id: true },
        })
      : [];
    const countOf = new Map(counts7d.map((c) => [c.enrollmentId, c._count.id]));
    const percents = active
      .map(
        (e) =>
          this.adherenceFor(
            this.genotypeVitals(e.program, e.genotype),
            e.thresholds,
            countOf.get(e.id) ?? 0,
          ).percent,
      )
      .filter((p): p is number => p != null);
    const avgAdherence = percents.length
      ? Math.round(percents.reduce((s, p) => s + p, 0) / percents.length)
      : null;

    const goalCounts = await prisma.programGoal.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const goalCount = (status: string) =>
      goalCounts.find((g) => g.status === status)?._count.id ?? 0;

    return {
      activeEnrollments,
      readings30d,
      alerts30d: {
        warning: alertCount("WARNING"),
        critical: alertCount("CRITICAL"),
      },
      openAlerts,
      avgAdherence,
      goals: {
        active: goalCount("ACTIVE"),
        achieved: goalCount("ACHIEVED"),
        missed: goalCount("MISSED"),
      },
      programs,
      outcomes,
      vitalCatalog: VITAL_CATALOG,
    };
  }
}
