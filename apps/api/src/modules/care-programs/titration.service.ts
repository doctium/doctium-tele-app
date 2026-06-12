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
import { RecordLabDto, SetDoseDto } from "./dto/care-programs.dto";

export interface LabFlag {
  key: string;
  severity: "WARNING" | "CRITICAL";
  label: string;
}

const DAY = 86_400_000;
const LAB_INTERVAL_DAYS = 56; // CBC at least every 8 weeks on hydroxyurea
const REVIEW_INTERVAL_DAYS = 56; // titration step considered after 8 stable weeks
const LAB_REMINDER_THROTTLE_DAYS = 14;
const MAX_MG_PER_KG = 35; // hydroxyurea maximum tolerated dose ceiling

// Sanity input bounds (units in the field comments on LabResult)
const LAB_BOUNDS: Record<string, { min: number; max: number; label: string }> =
  {
    hb: { min: 1, max: 25, label: "Haemoglobin (g/dL)" },
    wbc: { min: 0.1, max: 100, label: "WBC (×10⁹/L)" },
    anc: { min: 0, max: 50, label: "ANC (×10⁹/L)" },
    platelets: { min: 1, max: 2000, label: "Platelets (×10⁹/L)" },
    mcv: { min: 40, max: 160, label: "MCV (fL)" },
  };

/**
 * SCD Phase 5: hydroxyurea titration support. A dose-change log + CBC results
 * + a deterministic monitoring engine: myelotoxicity safety flags on every lab
 * (hold-dose signals go to the DOCTOR, never dosing advice to the patient),
 * CBC-overdue detection with throttled reminders, and titration-review-due
 * flags when the patient has been stable on a dose below MTD for 8+ weeks.
 * Strictly decision support — only the care lead writes doses.
 */
@Injectable()
export class TitrationService {
  private readonly logger = new Logger("CareTitration");

  constructor(private readonly notifications: NotificationsService) {}

  /** Deterministic myelotoxicity / anemia evaluation of one CBC. */
  evaluateLab(
    lab: {
      hb?: number | null;
      anc?: number | null;
      platelets?: number | null;
    },
    previousHb?: number | null,
  ): LabFlag[] {
    const flags: LabFlag[] = [];
    if (lab.anc != null) {
      if (lab.anc < 1.0) {
        flags.push({
          key: "ancCritical",
          severity: "CRITICAL",
          label: `ANC ${lab.anc} — severe neutropenia. Standard practice: hold hydroxyurea until counts recover.`,
        });
      } else if (lab.anc < 2.0) {
        flags.push({
          key: "ancLow",
          severity: "WARNING",
          label: `ANC ${lab.anc} — neutropenia. Consider holding or reducing the dose and repeating the CBC.`,
        });
      }
    }
    if (lab.platelets != null) {
      if (lab.platelets < 50) {
        flags.push({
          key: "plateletsCritical",
          severity: "CRITICAL",
          label: `Platelets ${lab.platelets} — severe thrombocytopenia. Standard practice: hold hydroxyurea.`,
        });
      } else if (lab.platelets < 80) {
        flags.push({
          key: "plateletsLow",
          severity: "WARNING",
          label: `Platelets ${lab.platelets} — below the usual safety floor of 80.`,
        });
      }
    }
    if (lab.hb != null) {
      if (lab.hb < 4.5) {
        flags.push({
          key: "hbCritical",
          severity: "CRITICAL",
          label: `Hb ${lab.hb} g/dL — severe anaemia. Urgent review needed.`,
        });
      } else if (previousHb != null && lab.hb < previousHb * 0.8) {
        flags.push({
          key: "hbFalling",
          severity: "WARNING",
          label: `Hb dropped from ${previousHb} to ${lab.hb} g/dL (>20%) since the last CBC.`,
        });
      }
    }
    return flags;
  }

  private async loadEnrollment(enrollmentId: string) {
    const e = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        program: { select: { name: true, vitals: true } },
        user: { select: { name: true } },
      },
    });
    if (!e) throw new NotFoundException("Enrollment not found");
    return e;
  }

  // ─── Dose log (care lead only) ───────────────────────────
  async setDose(enrollmentId: string, doctorId: string, dto: SetDoseDto) {
    const e = await this.loadEnrollment(enrollmentId);
    if (e.doctorId !== doctorId) {
      throw new ForbiddenException("You are not this patient's care lead");
    }
    if (e.status !== "ACTIVE") {
      throw new BadRequestException("This enrollment is not active");
    }

    const dose = await prisma.medicationDose.create({
      data: {
        enrollmentId,
        userId: e.userId,
        subPatientId: e.subPatientId,
        doseMgPerDay: dto.doseMgPerDay,
        weightKg: dto.weightKg ?? null,
        note: (dto.note ?? "").slice(0, 300),
        setByDoctorId: doctorId,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
      },
    });
    this.notifications
      .notifyUser(e.userId, {
        key: "care.doseUpdated",
        params: {
          program: e.program.name,
          dose: `${dto.doseMgPerDay}`,
        },
        type: "care_dose",
      })
      .catch(() => {});
    return dose;
  }

  // ─── Lab entry (patient or care lead) ────────────────────
  async recordLab(
    enrollmentId: string,
    requester: { sub: string; role: string },
    dto: RecordLabDto,
  ) {
    const e = await this.loadEnrollment(enrollmentId);
    const isOwner = requester.role === "user" && e.userId === requester.sub;
    const isLead = requester.role === "doctor" && e.doctorId === requester.sub;
    if (!isOwner && !isLead) {
      throw new ForbiddenException("Not your enrollment");
    }
    if (e.status !== "ACTIVE") {
      throw new BadRequestException("This enrollment is not active");
    }

    const values: Record<string, number | null> = {};
    let provided = 0;
    for (const key of Object.keys(LAB_BOUNDS)) {
      const raw = (dto as unknown as Record<string, unknown>)[key];
      if (raw == null || raw === "") {
        values[key] = null;
        continue;
      }
      const v = Number(raw);
      const bounds = LAB_BOUNDS[key];
      if (!bounds) continue;
      if (!Number.isFinite(v) || v < bounds.min || v > bounds.max) {
        throw new BadRequestException(
          `${bounds.label} must be between ${bounds.min} and ${bounds.max}`,
        );
      }
      values[key] = v;
      provided++;
    }
    if (provided === 0) {
      throw new BadRequestException("Enter at least one result");
    }

    const previous = await prisma.labResult.findFirst({
      where: { enrollmentId, hb: { not: null } },
      orderBy: { takenAt: "desc" },
      select: { hb: true },
    });
    const flags = this.evaluateLab(
      { hb: values.hb, anc: values.anc, platelets: values.platelets },
      previous?.hb,
    );

    const lab = await prisma.labResult.create({
      data: {
        enrollmentId,
        userId: e.userId,
        subPatientId: e.subPatientId,
        hb: values.hb,
        wbc: values.wbc,
        anc: values.anc,
        platelets: values.platelets,
        mcv: values.mcv,
        note: (dto.note ?? "").slice(0, 300),
        source: isLead ? "DOCTOR" : "PATIENT",
        recordedById: requester.sub,
        flags: flags as never,
        takenAt: dto.takenAt ? new Date(dto.takenAt) : new Date(),
      },
    });

    // Safety fan-out: hold-dose signals go to the care lead. The patient is
    // told their doctor has been alerted — never given dosing instructions.
    if (flags.length) {
      const worst = flags.some((f) => f.severity === "CRITICAL")
        ? "CRITICAL"
        : "WARNING";
      if (e.doctorId) {
        this.notifications
          .notifyDoctor(e.doctorId, {
            title:
              worst === "CRITICAL"
                ? "🔴 Lab results need urgent review"
                : "🟠 Lab results flagged",
            message: `${e.user?.name || "A patient"} (${e.program.name}): ${flags
              .map((f) => f.label)
              .join(" ")}`,
            type: "lab_alert",
          })
          .catch(() => {});
      }
      this.notifications
        .notifyUser(e.userId, {
          key: "care.labFlagged",
          params: { program: e.program.name },
          type: "lab_alert",
        })
        .catch(() => {});
    }

    return { lab, flags };
  }

  // ─── Titration picture (patient owner, care lead, admin) ─
  async getTitration(
    enrollmentId: string,
    requester: { sub: string; role: string },
  ) {
    const e = await this.loadEnrollment(enrollmentId);
    const allowed =
      requester.role === "admin" ||
      (requester.role === "user" && e.userId === requester.sub) ||
      (requester.role === "doctor" && e.doctorId === requester.sub);
    if (!allowed) throw new ForbiddenException("Not your enrollment");

    const [doses, labs, crises] = await Promise.all([
      prisma.medicationDose.findMany({
        where: { enrollmentId },
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
      prisma.labResult.findMany({
        where: { enrollmentId },
        orderBy: { takenAt: "desc" },
        take: 20,
      }),
      prisma.crisisEvent.findMany({
        where: { enrollmentId },
        select: { startedAt: true },
        orderBy: { startedAt: "desc" },
        take: 100,
      }),
    ]);

    const currentDose = doses[0] ?? null;
    const latestLab = labs[0] ?? null;
    const now = Date.now();

    // Dose-response: crises + labs landed during each dose period.
    const doseHistory = doses.map((d, i) => {
      const end = i === 0 ? now : (doses[i - 1]?.startedAt.getTime() ?? now);
      const start = d.startedAt.getTime();
      const crisesDuring = crises.filter(
        (c) => c.startedAt.getTime() >= start && c.startedAt.getTime() < end,
      ).length;
      const labsDuring = labs.filter(
        (l) => l.takenAt.getTime() >= start && l.takenAt.getTime() < end,
      );
      const hbs = labsDuring
        .map((l) => l.hb)
        .filter((v): v is number => v != null);
      return {
        ...d,
        crisesDuring,
        avgHbDuring: hbs.length
          ? Math.round((hbs.reduce((s, v) => s + v, 0) / hbs.length) * 10) / 10
          : null,
      };
    });

    const flags = (latestLab?.flags ?? []) as unknown as LabFlag[];
    const hasUnsafeFlags = flags.length > 0;
    const maxDailyMg = currentDose?.weightKg
      ? Math.round(MAX_MG_PER_KG * currentDose.weightKg)
      : null;
    const mgPerKg =
      currentDose?.weightKg && currentDose.weightKg > 0
        ? Math.round((currentDose.doseMgPerDay / currentDose.weightKg) * 10) /
          10
        : null;

    const dueReasons: string[] = [];
    if (currentDose) {
      const labAge = latestLab
        ? Math.floor((now - latestLab.takenAt.getTime()) / DAY)
        : null;
      if (labAge === null) {
        dueReasons.push(
          "No CBC on record — hydroxyurea needs blood-count monitoring.",
        );
      } else if (labAge > LAB_INTERVAL_DAYS) {
        dueReasons.push(
          `Last CBC was ${labAge} days ago — monitoring is due (every 8 weeks).`,
        );
      }
      const doseAge = Math.floor((now - currentDose.startedAt.getTime()) / DAY);
      const labFresh = labAge !== null && labAge <= 28;
      const belowMtd =
        maxDailyMg == null || currentDose.doseMgPerDay < maxDailyMg;
      if (
        doseAge >= REVIEW_INTERVAL_DAYS &&
        labFresh &&
        !hasUnsafeFlags &&
        belowMtd
      ) {
        dueReasons.push(
          `Stable on ${currentDose.doseMgPerDay} mg/day for ${doseAge} days with safe counts — consider the next titration step toward the maximum tolerated dose.`,
        );
      }
    }

    return {
      medication: "hydroxyurea",
      currentDose,
      mgPerKg,
      maxDailyMg,
      doseHistory,
      labs,
      latestLab,
      flags,
      dueReasons,
      disclaimer:
        "Decision support only — dosing decisions rest with the prescribing doctor.",
    };
  }

  // ─── CBC-due reminders (daily sweep) ─────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  runTitrationCron() {
    this.runLabReminders().catch((e) =>
      this.logger.warn(`titration sweep failed: ${(e as Error).message}`),
    );
  }

  /** Patients on hydroxyurea with no CBC in 8+ weeks get a reminder (14-day throttle). */
  async runLabReminders() {
    const doses = await prisma.medicationDose.groupBy({
      by: ["enrollmentId"],
      _max: { startedAt: true },
    });
    let reminded = 0;
    for (const d of doses) {
      const e = await prisma.programEnrollment.findUnique({
        where: { id: d.enrollmentId },
        include: { program: { select: { name: true } } },
      });
      if (!e || e.status !== "ACTIVE") continue;
      if (
        e.lastLabReminderAt &&
        e.lastLabReminderAt.getTime() >
          Date.now() - LAB_REMINDER_THROTTLE_DAYS * DAY
      )
        continue;

      const latestLab = await prisma.labResult.findFirst({
        where: { enrollmentId: e.id },
        orderBy: { takenAt: "desc" },
        select: { takenAt: true },
      });
      const anchor = latestLab?.takenAt ?? d._max.startedAt ?? e.startedAt;
      if (anchor.getTime() > Date.now() - LAB_INTERVAL_DAYS * DAY) continue;

      await prisma.programEnrollment.update({
        where: { id: e.id },
        data: { lastLabReminderAt: new Date() },
      });
      this.notifications
        .notifyUser(e.userId, {
          key: "care.labDue",
          params: { program: e.program.name },
          type: "lab_due",
        })
        .catch(() => {});
      reminded++;
    }
    this.logger.log(`titration sweep: reminded=${reminded}`);
    return { reminded };
  }
}
