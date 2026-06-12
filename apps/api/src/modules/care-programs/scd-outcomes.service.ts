import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@doctium/database";

const DAY = 86_400_000;

/**
 * SCD Phase 6: the investor/payer outcomes view for the sickle cell program —
 * enrollment mix by genotype, crisis burden, live risk distribution and trend,
 * hydroxyurea coverage with CBC monitoring compliance, engagement, and AI
 * leverage. Plus an anonymized per-patient CSV (no names/contacts — refs only).
 */
@Injectable()
export class ScdOutcomesService {
  private async loadProgram() {
    const program = await prisma.careProgram.findUnique({
      where: { code: "sickle_cell" },
      select: { id: true, name: true },
    });
    if (!program) throw new NotFoundException("Sickle cell program not seeded");
    return program;
  }

  async overview() {
    const program = await this.loadProgram();
    const enrollments = await prisma.programEnrollment.findMany({
      where: { programId: program.id },
      select: { id: true, genotype: true, status: true, startedAt: true },
    });
    const active = enrollments.filter((e) => e.status === "ACTIVE");
    const activeIds = active.map((e) => e.id);
    const since90 = new Date(Date.now() - 90 * DAY);

    const byGenotype: Record<string, number> = {};
    for (const e of active) {
      const g = e.genotype || "Unknown";
      byGenotype[g] = (byGenotype[g] ?? 0) + 1;
    }

    const [crises90, assessments, doses, labs90, readings30d, aiNotes] =
      await Promise.all([
        activeIds.length
          ? prisma.crisisEvent.findMany({
              where: {
                enrollmentId: { in: activeIds },
                startedAt: { gte: since90 },
              },
              select: {
                painScore: true,
                hospitalized: true,
                triggers: true,
              },
            })
          : [],
        activeIds.length
          ? prisma.riskAssessment.findMany({
              where: {
                enrollmentId: { in: activeIds },
                createdAt: { gte: new Date(Date.now() - 84 * DAY) },
              },
              select: {
                enrollmentId: true,
                score: true,
                level: true,
                createdAt: true,
              },
              orderBy: { createdAt: "asc" },
            })
          : [],
        activeIds.length
          ? prisma.medicationDose.findMany({
              where: { enrollmentId: { in: activeIds } },
              select: {
                enrollmentId: true,
                doseMgPerDay: true,
                startedAt: true,
              },
              orderBy: { startedAt: "desc" },
            })
          : [],
        activeIds.length
          ? prisma.labResult.findMany({
              where: {
                enrollmentId: { in: activeIds },
                takenAt: { gte: since90 },
              },
              select: { enrollmentId: true, flags: true, takenAt: true },
            })
          : [],
        activeIds.length
          ? prisma.vitalReading.count({
              where: {
                enrollmentId: { in: activeIds },
                takenAt: { gte: new Date(Date.now() - 30 * DAY) },
              },
            })
          : 0,
        prisma.clinicalNote.groupBy({
          by: ["aiDraftSource"],
          where: { aiDrafted: true },
          _count: { id: true },
        }),
      ]);

    // Crisis burden
    const triggerCounts: Record<string, number> = {};
    for (const c of crises90) {
      for (const t of Array.isArray(c.triggers) ? c.triggers : []) {
        if (typeof t === "string" && t)
          triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
      }
    }
    const crisisStats = {
      count90d: crises90.length,
      perActivePatient90d: active.length
        ? Math.round((crises90.length / active.length) * 100) / 100
        : 0,
      hospitalizations90d: crises90.filter((c) => c.hospitalized).length,
      topTriggers: Object.entries(triggerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([trigger, count]) => ({ trigger, count })),
    };

    // Live risk distribution (latest assessment per enrollment) + weekly trend
    const latestByEnrollment = new Map<
      string,
      { score: number; level: string }
    >();
    const weekly: Record<string, { sum: number; n: number }> = {};
    for (const a of assessments) {
      latestByEnrollment.set(a.enrollmentId, {
        score: a.score,
        level: a.level,
      });
      const week = new Date(a.createdAt);
      week.setHours(0, 0, 0, 0);
      week.setDate(week.getDate() - week.getDay()); // week start (Sunday)
      const key = week.toISOString().slice(0, 10);
      weekly[key] = {
        sum: (weekly[key]?.sum ?? 0) + a.score,
        n: (weekly[key]?.n ?? 0) + 1,
      };
    }
    const riskDistribution: Record<string, number> = {
      LOW: 0,
      MODERATE: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const r of latestByEnrollment.values()) {
      riskDistribution[r.level] = (riskDistribution[r.level] ?? 0) + 1;
    }
    const riskTrend = Object.entries(weekly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, v]) => ({
        week,
        avgScore: Math.round(v.sum / v.n),
        assessments: v.n,
      }));

    // Hydroxyurea coverage + CBC monitoring compliance
    const doseByEnrollment = new Map<string, number>();
    for (const d of doses) {
      if (!doseByEnrollment.has(d.enrollmentId))
        doseByEnrollment.set(d.enrollmentId, d.doseMgPerDay);
    }
    const onHydroxyurea = doseByEnrollment.size;
    const labbedRecently = new Set(
      labs90
        .filter((l) => l.takenAt.getTime() > Date.now() - 56 * DAY)
        .map((l) => l.enrollmentId),
    );
    const monitored = activeIds.filter(
      (id) => doseByEnrollment.has(id) && labbedRecently.has(id),
    ).length;
    const titration = {
      onHydroxyurea,
      avgDoseMg: onHydroxyurea
        ? Math.round(
            [...doseByEnrollment.values()].reduce((s, v) => s + v, 0) /
              onHydroxyurea,
          )
        : null,
      cbcCompliancePercent: onHydroxyurea
        ? Math.round((monitored / onHydroxyurea) * 100)
        : null,
      flaggedLabs90d: labs90.filter(
        (l) => Array.isArray(l.flags) && l.flags.length > 0,
      ).length,
    };

    // AI leverage (platform-wide scribe adoption)
    const aiDraftedNotes: Record<string, number> = {};
    let aiTotal = 0;
    for (const row of aiNotes) {
      aiDraftedNotes[row.aiDraftSource || "UNKNOWN"] = row._count.id;
      aiTotal += row._count.id;
    }

    // Enrollment growth (6 months)
    const growth: Record<string, number> = {};
    for (const e of enrollments) {
      const key = e.startedAt.toISOString().slice(0, 7);
      growth[key] = (growth[key] ?? 0) + 1;
    }
    const enrollmentGrowth = Object.entries(growth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({ month, count }));

    return {
      program: program.name,
      activePatients: active.length,
      totalEnrollments: enrollments.length,
      byGenotype,
      crisisStats,
      riskDistribution,
      riskTrend,
      titration,
      readings30d,
      aiScribe: { totalDraftedNotes: aiTotal, bySource: aiDraftedNotes },
      enrollmentGrowth,
    };
  }

  /** Anonymized per-patient rows — refs only, no names or contacts. */
  async investorCsv(): Promise<string> {
    const program = await this.loadProgram();
    const enrollments = await prisma.programEnrollment.findMany({
      where: { programId: program.id },
      select: {
        id: true,
        genotype: true,
        status: true,
        startedAt: true,
        thresholds: true,
      },
      orderBy: { startedAt: "asc" },
      take: 1000,
    });

    const rows: string[] = [
      [
        "patientRef",
        "genotype",
        "status",
        "monthsEnrolled",
        "crises90d",
        "hospitalizations90d",
        "riskScoreLatest",
        "riskLevelLatest",
        "onHydroxyurea",
        "currentDoseMg",
        "lastHb",
        "daysSinceLastCbc",
        "readings30d",
      ].join(","),
    ];
    const since90 = new Date(Date.now() - 90 * DAY);

    for (const e of enrollments) {
      const [crises, risk, dose, lab, readings30d] = await Promise.all([
        prisma.crisisEvent.findMany({
          where: { enrollmentId: e.id, startedAt: { gte: since90 } },
          select: { hospitalized: true },
        }),
        prisma.riskAssessment.findFirst({
          where: { enrollmentId: e.id },
          orderBy: { createdAt: "desc" },
          select: { score: true, level: true },
        }),
        prisma.medicationDose.findFirst({
          where: { enrollmentId: e.id },
          orderBy: { startedAt: "desc" },
          select: { doseMgPerDay: true },
        }),
        prisma.labResult.findFirst({
          where: { enrollmentId: e.id },
          orderBy: { takenAt: "desc" },
          select: { hb: true, takenAt: true },
        }),
        prisma.vitalReading.count({
          where: {
            enrollmentId: e.id,
            takenAt: { gte: new Date(Date.now() - 30 * DAY) },
          },
        }),
      ]);
      rows.push(
        [
          e.id.slice(0, 8),
          e.genotype || "UNKNOWN",
          e.status,
          Math.max(
            0,
            Math.round(
              ((Date.now() - e.startedAt.getTime()) / (30 * DAY)) * 10,
            ) / 10,
          ),
          crises.length,
          crises.filter((c) => c.hospitalized).length,
          risk?.score ?? "",
          risk?.level ?? "",
          dose ? "yes" : "no",
          dose?.doseMgPerDay ?? "",
          lab?.hb ?? "",
          lab ? Math.floor((Date.now() - lab.takenAt.getTime()) / DAY) : "",
          readings30d,
        ].join(","),
      );
    }
    return rows.join("\n");
  }
}
