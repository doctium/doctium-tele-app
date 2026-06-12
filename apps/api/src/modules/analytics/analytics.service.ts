import { Injectable } from "@nestjs/common";
import { prisma } from "@doctium/database";
import { EntitlementsService } from "../subscriptions/entitlements.service";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-06" for a Date. Appointment.date strings ("YYYY-MM-DD") slice to the same key. */
const ym = (d: Date) => d.toISOString().slice(0, 7);

/** Last `n` month keys ending at the current month, oldest first. */
function lastMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    out.push({
      key: ym(d),
      label: `${MONTH_LABELS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
    });
  }
  return out;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

const daysBetween = (a: Date, b: Date) =>
  Math.abs(b.getTime() - a.getTime()) / 86_400_000;

/**
 * Business-intelligence aggregations on top of the booking/money data.
 * Doctor "advanced" analytics is the premium tier — gated by the
 * `advancedAnalytics` plan benefit (EntitlementsService is the authority).
 * All money values are Int kobo, same as everywhere else.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly entitlements: EntitlementsService) {}

  // ─── Doctor: practice analytics ────────────────────────────────────────────

  async getDoctorAnalytics(doctorId: string) {
    const ent = await this.entitlements.resolveDoctorEntitlements(doctorId);
    const premium = ent.advancedAnalytics;

    const [appointments, doctor] = await Promise.all([
      prisma.appointment.findMany({
        where: { doctorId },
        select: {
          date: true,
          time: true,
          status: true,
          doctorEarning: true,
          userId: true,
          serviceId: true,
          createdAt: true,
        },
      }),
      prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { rating: true, reviewCount: true, currency: true },
      }),
    ]);

    const completed = appointments.filter((a) => a.status === "COMPLETED");
    const cancelled = appointments.filter((a) => a.status === "CANCELLED");
    const decided = completed.length + cancelled.length;
    const thisMonth = ym(new Date());
    const uniquePatients = new Set(completed.map((a) => a.userId));

    const basic = {
      currency: doctor?.currency ?? "NGN",
      totalConsultations: appointments.length,
      completedConsultations: completed.length,
      cancelledConsultations: cancelled.length,
      completionRate: pct(completed.length, decided),
      uniquePatients: uniquePatients.size,
      thisMonthEarnings: completed
        .filter((a) => a.date.slice(0, 7) === thisMonth)
        .reduce((s, a) => s + a.doctorEarning, 0),
      rating: doctor?.rating ?? 0,
      reviewCount: doctor?.reviewCount ?? 0,
    };

    if (!premium) {
      return { premium: false, planCode: ent.planCode, basic, advanced: null };
    }

    // Earnings + volume trend (12 months) and cancellation trend (6 months)
    const months12 = lastMonths(12);
    const earningsTrend = months12.map((m) => {
      const inMonth = completed.filter((a) => a.date.slice(0, 7) === m.key);
      return {
        month: m.key,
        label: m.label,
        earnings: inMonth.reduce((s, a) => s + a.doctorEarning, 0),
        consultations: inMonth.length,
      };
    });

    const cancellationTrend = lastMonths(6).map((m) => {
      const done = completed.filter((a) => a.date.slice(0, 7) === m.key).length;
      const lost = cancelled.filter((a) => a.date.slice(0, 7) === m.key).length;
      return {
        month: m.key,
        label: m.label,
        completed: done,
        cancelled: lost,
        rate: pct(lost, done + lost),
      };
    });

    // Retention: a patient who came back for a 2nd+ completed consult is "retained".
    const consultsByPatient = new Map<string, string[]>();
    for (const a of completed) {
      const list = consultsByPatient.get(a.userId) ?? [];
      list.push(a.date);
      consultsByPatient.set(a.userId, list);
    }
    const returningPatients = [...consultsByPatient.values()].filter(
      (d) => d.length >= 2,
    ).length;
    const retention = {
      uniquePatients: uniquePatients.size,
      returningPatients,
      newPatients: uniquePatients.size - returningPatients,
      retentionRate: pct(returningPatients, uniquePatients.size),
      avgConsultsPerPatient:
        uniquePatients.size > 0
          ? Math.round((completed.length / uniquePatients.size) * 10) / 10
          : 0,
    };

    // New vs returning mix per month (returning = patient seen in an earlier month)
    const firstMonthByPatient = new Map<string, string>();
    for (const [userId, dates] of consultsByPatient) {
      firstMonthByPatient.set(
        userId,
        dates.map((d) => d.slice(0, 7)).sort()[0] ?? "",
      );
    }
    const patientMix = lastMonths(6).map((m) => {
      const patientsInMonth = new Set(
        completed
          .filter((a) => a.date.slice(0, 7) === m.key)
          .map((a) => a.userId),
      );
      let fresh = 0;
      for (const p of patientsInMonth)
        if (firstMonthByPatient.get(p) === m.key) fresh++;
      return {
        month: m.key,
        label: m.label,
        newPatients: fresh,
        returningPatients: patientsInMonth.size - fresh,
      };
    });

    // Peak booking hours / days (every booking that wasn't cancelled counts as demand)
    const demand = appointments.filter((a) => a.status !== "CANCELLED");
    const hourCounts = new Array(24).fill(0) as number[];
    const dayCounts = new Array(7).fill(0) as number[];
    for (const a of demand) {
      const hour = parseInt(a.time.slice(0, 2), 10);
      if (hour >= 0 && hour < 24)
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      const day = new Date(`${a.date}T00:00:00Z`).getUTCDay();
      if (day >= 0 && day < 7) dayCounts[day] = (dayCounts[day] ?? 0) + 1;
    }
    const peakHours = hourCounts.map((count, hour) => ({ hour, count }));
    const peakDays = dayCounts.map((count, day) => ({
      day: DAY_LABELS[day] ?? "",
      count,
    }));

    // Top services by completed volume
    const serviceAgg = new Map<string, { count: number; earnings: number }>();
    for (const a of completed) {
      if (!a.serviceId) continue;
      const cur = serviceAgg.get(a.serviceId) ?? { count: 0, earnings: 0 };
      cur.count++;
      cur.earnings += a.doctorEarning;
      serviceAgg.set(a.serviceId, cur);
    }
    const serviceIds = [...serviceAgg.keys()];
    const services = serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        })
      : [];
    const serviceNames = new Map(services.map((s) => [s.id, s.name]));
    const topServices = [...serviceAgg.entries()]
      .map(([id, v]) => ({ name: serviceNames.get(id) ?? "Other", ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Rating trend (6 months)
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    const reviews = await prisma.review.findMany({
      where: { doctorId, createdAt: { gte: since } },
      select: { rating: true, createdAt: true },
    });
    const ratingTrend = lastMonths(6).map((m) => {
      const inMonth = reviews.filter((r) => ym(r.createdAt) === m.key);
      const avg = inMonth.length
        ? Math.round(
            (inMonth.reduce((s, r) => s + r.rating, 0) / inMonth.length) * 10,
          ) / 10
        : null;
      return {
        month: m.key,
        label: m.label,
        rating: avg,
        reviews: inMonth.length,
      };
    });

    return {
      premium: true,
      planCode: ent.planCode,
      basic,
      advanced: {
        earningsTrend,
        cancellationTrend,
        retention,
        patientMix,
        peakHours,
        peakDays,
        topServices,
        ratingTrend,
      },
    };
  }

  // ─── Patient: health & spend insights ──────────────────────────────────────

  async getPatientAnalytics(userId: string) {
    const [appointments, healthProfile, conditionCount] = await Promise.all([
      prisma.appointment.findMany({
        where: { userId },
        select: {
          date: true,
          status: true,
          amount: true,
          doctorId: true,
          noShowAt: true,
        },
      }),
      prisma.healthProfile.findFirst({ where: { userId, subPatientId: null } }),
      prisma.medicalCondition.count({ where: { userId } }),
    ]);
    const doctorIds = [...new Set(appointments.map((a) => a.doctorId))];
    const doctors = doctorIds.length
      ? await prisma.doctor.findMany({
          where: { id: { in: doctorIds } },
          select: { id: true, designation: true },
        })
      : [];
    const specialtyOf = new Map(
      doctors.map((d) => [d.id, d.designation || "General practice"]),
    );

    const completed = appointments.filter((a) => a.status === "COMPLETED");
    const totalSpent = completed.reduce((s, a) => s + a.amount, 0);

    const monthly = lastMonths(12).map((m) => {
      const inMonth = completed.filter((a) => a.date.slice(0, 7) === m.key);
      return {
        month: m.key,
        label: m.label,
        consultations: inMonth.length,
        spent: inMonth.reduce((s, a) => s + a.amount, 0),
      };
    });

    const bySpecialtyMap = new Map<string, { count: number; spent: number }>();
    for (const a of completed) {
      const key = specialtyOf.get(a.doctorId) ?? "General practice";
      const cur = bySpecialtyMap.get(key) ?? { count: 0, spent: 0 };
      cur.count++;
      cur.spent += a.amount;
      bySpecialtyMap.set(key, cur);
    }
    const bySpecialty = [...bySpecialtyMap.entries()]
      .map(([specialty, v]) => ({ specialty, ...v }))
      .sort((a, b) => b.count - a.count);

    // ── Health engagement score (0–100, heuristic) ──
    // profile (25): how complete the medical profile is
    // care (30): how recently the patient saw a doctor
    // attendance (25): kept vs missed/cancelled appointments
    // vitals (20): BMI in range when height+weight are recorded
    const scoreAt = (
      ref: Date,
    ): {
      total: number;
      factors: {
        key: string;
        label: string;
        score: number;
        max: number;
        hint: string;
      }[];
    } => {
      let profileScore = 0;
      if (healthProfile) {
        profileScore += 7;
        if (healthProfile.bloodType) profileScore += 4;
        if (healthProfile.genotype) profileScore += 4;
        if (healthProfile.heightCm && healthProfile.weightKg) profileScore += 6;
      }
      if (conditionCount > 0) profileScore += 4;
      profileScore = Math.min(25, profileScore);

      const upTo = completed.filter(
        (a) => new Date(`${a.date}T00:00:00Z`) <= ref,
      );
      const last = upTo
        .map((a) => a.date)
        .sort()
        .at(-1);
      let careScore = 0;
      if (last) {
        const gap = daysBetween(new Date(`${last}T00:00:00Z`), ref);
        careScore = gap <= 90 ? 30 : gap <= 180 ? 20 : gap <= 365 ? 10 : 4;
      }

      const decidedUpTo = appointments.filter(
        (a) =>
          new Date(`${a.date}T00:00:00Z`) <= ref &&
          (a.status === "COMPLETED" || a.status === "CANCELLED" || a.noShowAt),
      );
      const keptRate = decidedUpTo.length
        ? upTo.length / decidedUpTo.length
        : 1;
      const attendanceScore = Math.round(keptRate * 25);

      let vitalsScore = 8; // neutral when not recorded
      if (healthProfile?.heightCm && healthProfile?.weightKg) {
        const bmi =
          healthProfile.weightKg / Math.pow(healthProfile.heightCm / 100, 2);
        vitalsScore =
          bmi >= 18.5 && bmi < 25 ? 20 : bmi >= 25 && bmi < 30 ? 12 : 6;
      }

      const factors = [
        {
          key: "profile",
          label: "Medical profile",
          score: profileScore,
          max: 25,
          hint: "Complete your health profile (blood type, genotype, height & weight).",
        },
        {
          key: "care",
          label: "Recent care",
          score: careScore,
          max: 30,
          hint: "See a doctor at least once every 3 months.",
        },
        {
          key: "attendance",
          label: "Appointment attendance",
          score: attendanceScore,
          max: 25,
          hint: "Keep your booked appointments.",
        },
        {
          key: "vitals",
          label: "Body metrics",
          score: vitalsScore,
          max: 20,
          hint: "A BMI in the healthy range boosts this.",
        },
      ];
      return { total: factors.reduce((s, f) => s + f.score, 0), factors };
    };

    const now = new Date();
    const current = scoreAt(now);
    const healthScoreSeries = lastMonths(6).map((m, i, arr) => {
      // score as of the end of that month (current month = today)
      const [y, mo] = m.key.split("-").map(Number);
      const end =
        i === arr.length - 1
          ? now
          : new Date(Date.UTC(y ?? 1970, mo ?? 1, 0, 23, 59, 59));
      return { month: m.key, label: m.label, score: scoreAt(end).total };
    });

    return {
      summary: {
        totalConsultations: appointments.length,
        completedConsultations: completed.length,
        totalSpent,
        avgPerConsult: completed.length
          ? Math.round(totalSpent / completed.length)
          : 0,
        distinctDoctors: new Set(completed.map((a) => a.doctorId)).size,
        healthScore: current.total,
      },
      healthScoreFactors: current.factors,
      healthScoreSeries,
      monthly,
      bySpecialty,
    };
  }

  // ─── Admin: business intelligence ──────────────────────────────────────────

  async getAdminOverview() {
    const d30 = new Date(Date.now() - 30 * 86_400_000);
    const cutoff30 = d30.toISOString().slice(0, 10);

    const [newUsers30d, newDoctors30d, active, patientsEver, churn] =
      await Promise.all([
        prisma.user.count({
          where: { isDelete: false, createdAt: { gte: d30 } },
        }),
        prisma.doctor.count({
          where: { isDelete: false, createdAt: { gte: d30 } },
        }),
        prisma.appointment.groupBy({
          by: ["userId"],
          where: { date: { gte: cutoff30 } },
        }),
        prisma.appointment.groupBy({
          by: ["userId"],
          where: { status: "COMPLETED" },
          _count: { id: true },
          _sum: { amount: true },
        }),
        this.getChurnRisk(),
      ]);

    const repeatPatients = patientsEver.filter((p) => p._count.id >= 2).length;
    const totalRevenue = patientsEver.reduce(
      (s, p) => s + (p._sum.amount ?? 0),
      0,
    );

    return {
      activePatients30d: active.length,
      newUsers30d,
      newDoctors30d,
      payingPatients: patientsEver.length,
      repeatRate: pct(repeatPatients, patientsEver.length),
      avgRevenuePerPatient: patientsEver.length
        ? Math.round(totalRevenue / patientsEver.length)
        : 0,
      churnBuckets: churn.buckets,
    };
  }

  /** Signup cohorts (month joined) × share still booking k months later. */
  async getAdminCohorts() {
    const months = lastMonths(8);
    const start = new Date(`${months[0]?.key}-01T00:00:00Z`);
    const users = await prisma.user.findMany({
      where: { isDelete: false, createdAt: { gte: start } },
      select: { id: true, createdAt: true },
    });
    const userIds = users.map((u) => u.id);
    const appointments = userIds.length
      ? await prisma.appointment.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, date: true },
        })
      : [];

    const activeMonths = new Map<string, Set<string>>();
    for (const a of appointments) {
      const set = activeMonths.get(a.userId) ?? new Set<string>();
      set.add(a.date.slice(0, 7));
      activeMonths.set(a.userId, set);
    }

    const monthIndex = new Map(months.map((m, i) => [m.key, i]));
    const currentIdx = months.length - 1;

    const cohorts = months.map((m, cohortIdx) => {
      const cohortUsers = users.filter((u) => ym(u.createdAt) === m.key);
      const retention: (number | null)[] = [];
      for (let k = 0; k < months.length; k++) {
        if (cohortIdx + k > currentIdx) {
          retention.push(null); // month is in the future
          continue;
        }
        const targetKey = months[cohortIdx + k]?.key ?? "";
        const activeCount = cohortUsers.filter((u) =>
          activeMonths.get(u.id)?.has(targetKey),
        ).length;
        retention.push(pct(activeCount, cohortUsers.length));
      }
      return {
        month: m.key,
        label: m.label,
        size: cohortUsers.length,
        retention,
      };
    });

    return {
      months: months.map((m) => m.label),
      cohorts,
      monthCount: monthIndex.size,
    };
  }

  /**
   * Heuristic churn prediction: compares each patient's silence (days since
   * last completed consult) against their own historical consult cadence.
   * A recent NPS detractor response (≤6 in the last 90d) bumps the risk one
   * level — unhappy patients churn long before their cadence shows it.
   */
  async getChurnRisk() {
    const [completed, detractorSurveys] = await Promise.all([
      prisma.appointment.findMany({
        where: { status: "COMPLETED" },
        select: { userId: true, date: true },
        orderBy: { date: "asc" },
      }),
      prisma.satisfactionSurvey.findMany({
        where: {
          status: "COMPLETED",
          npsScore: { lte: 6 },
          respondedAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
        },
        select: { userId: true, npsScore: true, respondedAt: true },
        orderBy: { respondedAt: "desc" },
      }),
    ]);
    // latest detractor score per patient (list is newest-first)
    const detractorScore = new Map<string, number>();
    for (const s of detractorSurveys) {
      if (s.npsScore != null && !detractorScore.has(s.userId))
        detractorScore.set(s.userId, s.npsScore);
    }

    const byUser = new Map<string, string[]>();
    for (const a of completed) {
      const list = byUser.get(a.userId) ?? [];
      list.push(a.date);
      byUser.set(a.userId, list);
    }

    const now = new Date();
    type Risk = {
      userId: string;
      score: number;
      daysSinceLast: number;
      avgGapDays: number;
      consultations: number;
      detractor: boolean;
      npsScore: number | null;
      level: "HIGH" | "MEDIUM" | "LOW";
    };
    const risks: Risk[] = [];
    for (const [userId, dates] of byUser) {
      const last = dates.at(-1);
      if (!last) continue;
      const daysSinceLast = Math.round(
        daysBetween(new Date(`${last}T00:00:00Z`), now),
      );
      let avgGap = 60; // assumed cadence for one-time patients
      if (dates.length >= 2) {
        let total = 0;
        for (let i = 1; i < dates.length; i++) {
          total += daysBetween(
            new Date(`${dates[i - 1]}T00:00:00Z`),
            new Date(`${dates[i]}T00:00:00Z`),
          );
        }
        avgGap = Math.max(14, total / (dates.length - 1));
      }
      // >1 = overdue vs their own rhythm; clamp so fresh patients don't rank high
      const score = Math.round((daysSinceLast / (avgGap * 1.5)) * 100) / 100;
      const detractor = detractorScore.has(userId);
      const base: Risk["level"] =
        score >= 2 && daysSinceLast >= 45
          ? "HIGH"
          : score >= 1.2
            ? "MEDIUM"
            : "LOW";
      const level: Risk["level"] = detractor
        ? base === "LOW"
          ? "MEDIUM"
          : "HIGH"
        : base;
      risks.push({
        userId,
        score,
        daysSinceLast,
        avgGapDays: Math.round(avgGap),
        consultations: dates.length,
        detractor,
        npsScore: detractorScore.get(userId) ?? null,
        level,
      });
    }

    const high = risks.filter((r) => r.level === "HIGH");
    const medium = risks.filter((r) => r.level === "MEDIUM");
    const low = risks.filter((r) => r.level === "LOW");

    const top = [...high, ...medium]
      .sort(
        (a, b) =>
          b.score +
          (b.detractor ? 1.5 : 0) -
          (a.score + (a.detractor ? 1.5 : 0)),
      )
      .slice(0, 20);
    const users = top.length
      ? await prisma.user.findMany({
          where: { id: { in: top.map((t) => t.userId) } },
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            image: true,
          },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    return {
      buckets: { high: high.length, medium: medium.length, low: low.length },
      atRisk: top.map((t) => ({
        ...t,
        name: userById.get(t.userId)?.name ?? "",
        email: userById.get(t.userId)?.email ?? "",
        mobile: userById.get(t.userId)?.mobile ?? "",
        image: userById.get(t.userId)?.image ?? "",
      })),
    };
  }

  async getRevenueBySpecialty(startDate?: string, endDate?: string) {
    const dateFilter =
      startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};
    const grouped = await prisma.appointment.groupBy({
      by: ["doctorId"],
      where: { status: "COMPLETED", ...dateFilter },
      _sum: { amount: true, adminEarning: true },
      _count: { id: true },
    });
    const doctors = grouped.length
      ? await prisma.doctor.findMany({
          where: { id: { in: grouped.map((g) => g.doctorId) } },
          select: { id: true, designation: true },
        })
      : [];
    const specialtyOf = new Map(
      doctors.map((d) => [d.id, d.designation || "General practice"]),
    );

    const agg = new Map<
      string,
      {
        revenue: number;
        adminEarning: number;
        consultations: number;
        doctors: Set<string>;
      }
    >();
    for (const g of grouped) {
      const key = specialtyOf.get(g.doctorId) ?? "General practice";
      const cur = agg.get(key) ?? {
        revenue: 0,
        adminEarning: 0,
        consultations: 0,
        doctors: new Set<string>(),
      };
      cur.revenue += g._sum.amount ?? 0;
      cur.adminEarning += g._sum.adminEarning ?? 0;
      cur.consultations += g._count.id;
      cur.doctors.add(g.doctorId);
      agg.set(key, cur);
    }
    return [...agg.entries()]
      .map(([specialty, v]) => ({
        specialty,
        revenue: v.revenue,
        adminEarning: v.adminEarning,
        consultations: v.consultations,
        doctors: v.doctors.size,
        avgFee: v.consultations ? Math.round(v.revenue / v.consultations) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /** Patient/doctor distribution + revenue by country, plus map points. */
  async getGeoDistribution(startDate?: string, endDate?: string) {
    const dateFilter =
      startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};
    const [users, doctors, grouped] = await Promise.all([
      prisma.user.findMany({
        where: { isDelete: false },
        select: { id: true, country: true, latitude: true, longitude: true },
      }),
      prisma.doctor.findMany({
        where: { isDelete: false },
        select: { practiceCountry: true },
      }),
      prisma.appointment.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED", ...dateFilter },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const byCountry = new Map<
      string,
      {
        patients: number;
        consultations: number;
        revenue: number;
        doctors: number;
      }
    >();
    const bump = (country: string) => {
      const key = country || "Unknown";
      const cur = byCountry.get(key) ?? {
        patients: 0,
        consultations: 0,
        revenue: 0,
        doctors: 0,
      };
      byCountry.set(key, cur);
      return cur;
    };
    for (const u of users) bump(u.country).patients++;
    for (const d of doctors) bump(d.practiceCountry).doctors++;
    for (const g of grouped) {
      const cur = bump(userById.get(g.userId)?.country ?? "");
      cur.consultations += g._count.id;
      cur.revenue += g._sum.amount ?? 0;
    }

    const consultsByUser = new Map(grouped.map((g) => [g.userId, g._count.id]));
    const points = users
      .filter((u) => u.latitude && u.longitude)
      .slice(0, 500)
      .map((u) => ({
        lat: parseFloat(u.latitude),
        lng: parseFloat(u.longitude),
        weight: 1 + (consultsByUser.get(u.id) ?? 0),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    return {
      countries: [...byCountry.entries()]
        .map(([country, v]) => ({ country, ...v }))
        .sort((a, b) => b.patients - a.patients),
      points,
    };
  }
}
