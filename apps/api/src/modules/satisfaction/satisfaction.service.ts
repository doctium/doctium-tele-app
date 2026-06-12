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
import { RespondSurveyDto } from "./dto/satisfaction.dto";

/** Qualitative feedback dimensions (1–5 each). Stored as JSON so this can evolve without migrations. */
export const SURVEY_CATEGORIES = [
  { key: "communication", label: "Communication" },
  { key: "waitTime", label: "Wait time" },
  { key: "diagnosisClarity", label: "Diagnosis clarity" },
  { key: "careQuality", label: "Overall care" },
] as const;
const CATEGORY_KEYS = SURVEY_CATEGORIES.map((c) => c.key) as string[];

const SURVEY_DELAY_MS = 24 * 3600_000; // notify 24h after the consult completes
const RESPONSE_WINDOW_MS = 7 * 24 * 3600_000; // then 7 days to answer

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

function lastMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    out.push({
      key: d.toISOString().slice(0, 7),
      label: `${MONTH_LABELS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
    });
  }
  return out;
}

type Response = {
  npsScore: number | null;
  categories: unknown;
  wouldBookAgain: boolean | null;
  respondedAt: Date | null;
};

/** NPS = %promoters (9–10) − %detractors (0–6), range −100..100. */
function npsOf(scores: number[]): number | null {
  if (!scores.length) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

function categoryAverages(
  responses: Response[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const key of CATEGORY_KEYS) {
    const vals = responses
      .map((r) => (r.categories as Record<string, number> | null)?.[key])
      .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
    out[key] = vals.length
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
      : null;
  }
  return out;
}

const CATEGORY_ADVICE: Record<string, string> = {
  communication:
    "Patients find communication hard to follow. Slow down, avoid jargon, and close each consult by summarising the plan and checking nothing is unclear.",
  waitTime:
    "Patients report waiting too long. Start consultations on time and keep a buffer between slots — or extend your slot duration in Schedule settings.",
  diagnosisClarity:
    "Diagnosis explanations aren't landing. Walk through what you found, what it means, and the next steps in plain language; a short written summary in the clinical note helps.",
  careQuality:
    "Overall care scores are low. Review your recent consultations and consider scheduling follow-ups with patients who scored their visit poorly.",
};

/**
 * Patient Satisfaction & NPS engine.
 *  • Auto-queues one survey per completed consult, delivered 24h later by cron.
 *  • Collects NPS (0–10) + category scores + free-text comment.
 *  • Aggregates doctor/platform NPS and emits rule-based improvement recommendations.
 * Doctor-facing output is anonymized; admin sees identities.
 */
@Injectable()
export class SatisfactionService {
  private readonly logger = new Logger("Satisfaction");

  constructor(private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runCron() {
    try {
      await this.processDue();
      await this.expireStale();
    } catch (e) {
      this.logger.warn(`satisfaction pass failed: ${(e as Error).message}`);
    }
  }

  // ─── Scheduling & delivery ───────────────────────────────
  /** Queue the post-consult survey (idempotent — one per appointment). */
  async scheduleSurvey(appt: {
    id: string;
    userId: string;
    doctorId: string;
    subPatientId: string | null;
  }) {
    await prisma.satisfactionSurvey.upsert({
      where: { appointmentId: appt.id },
      create: {
        appointmentId: appt.id,
        userId: appt.userId,
        doctorId: appt.doctorId,
        subPatientId: appt.subPatientId,
        scheduledFor: new Date(Date.now() + SURVEY_DELAY_MS),
      },
      update: {},
    });
    this.logger.log(`survey queued for appointment ${appt.id}`);
  }

  /** Deliver every due survey (mark-first so overlapping passes can't double-send). */
  async processDue(): Promise<{ sent: number }> {
    const due = await prisma.satisfactionSurvey.findMany({
      where: { status: "PENDING", scheduledFor: { lte: new Date() } },
      include: { doctor: { select: { name: true } } },
      take: 200,
    });
    let sent = 0;
    for (const s of due) {
      const claimed = await prisma.satisfactionSurvey.updateMany({
        where: { id: s.id, status: "PENDING" },
        data: { status: "SENT", sentAt: new Date() },
      });
      if (claimed.count === 0) continue;

      const dr = s.doctor?.name ? `Dr. ${s.doctor.name}` : "your doctor";
      await this.notifications
        .notifyUser(s.userId, {
          key: "satisfaction.survey",
          params: { doctor: dr },
          type: "satisfaction_survey",
        })
        .catch(() => {});
      sent++;
    }
    if (sent) this.logger.log(`satisfaction surveys delivered: ${sent}`);
    return { sent };
  }

  /** Close the response window on unanswered surveys. */
  async expireStale(): Promise<{ expired: number }> {
    const { count } = await prisma.satisfactionSurvey.updateMany({
      where: {
        status: "SENT",
        sentAt: { lt: new Date(Date.now() - RESPONSE_WINDOW_MS) },
      },
      data: { status: "EXPIRED" },
    });
    if (count) this.logger.log(`satisfaction surveys expired: ${count}`);
    return { expired: count };
  }

  /** Manual trigger for the admin panel / tests (mirrors run-follow-ups). */
  async runManual() {
    const { sent } = await this.processDue();
    const { expired } = await this.expireStale();
    return { delivered: sent, expired };
  }

  // ─── Patient ─────────────────────────────────────────────
  async getMine(userId: string) {
    const [open, completed] = await Promise.all([
      prisma.satisfactionSurvey.findMany({
        where: { userId, status: { in: ["PENDING", "SENT"] } },
        include: {
          doctor: { select: { name: true, image: true, designation: true } },
          appointment: { select: { date: true, time: true } },
        },
        orderBy: { scheduledFor: "desc" },
        take: 20,
      }),
      prisma.satisfactionSurvey.findMany({
        where: { userId, status: "COMPLETED" },
        include: {
          doctor: { select: { name: true, image: true, designation: true } },
          appointment: { select: { date: true, time: true } },
        },
        orderBy: { respondedAt: "desc" },
        take: 20,
      }),
    ]);
    return { open, completed, categories: SURVEY_CATEGORIES };
  }

  async respond(surveyId: string, userId: string, dto: RespondSurveyDto) {
    const survey = await prisma.satisfactionSurvey.findUnique({
      where: { id: surveyId },
    });
    if (!survey) throw new NotFoundException("Survey not found");
    if (survey.userId !== userId)
      throw new ForbiddenException("Not your survey");
    if (survey.status === "COMPLETED")
      throw new BadRequestException("Survey already answered");
    if (survey.status === "EXPIRED" || survey.status === "CANCELLED")
      throw new BadRequestException("This survey is no longer open");

    // Only catalog categories, integer 1–5
    const categories: Record<string, number> = {};
    for (const [k, v] of Object.entries(dto.categories ?? {})) {
      if (!CATEGORY_KEYS.includes(k)) continue;
      if (!Number.isInteger(v) || v < 1 || v > 5)
        throw new BadRequestException(`Category "${k}" must be 1–5`);
      categories[k] = v;
    }

    return prisma.satisfactionSurvey.update({
      where: { id: surveyId },
      data: {
        npsScore: dto.npsScore,
        categories,
        comment: (dto.comment ?? "").slice(0, 1000),
        wouldBookAgain: dto.wouldBookAgain ?? null,
        status: "COMPLETED",
        respondedAt: new Date(),
      },
    });
  }

  // ─── Doctor ──────────────────────────────────────────────
  async getDoctorSummary(doctorId: string) {
    const since90 = new Date(Date.now() - 90 * 86_400_000);
    const [responses, statusCounts, platform90] = await Promise.all([
      prisma.satisfactionSurvey.findMany({
        where: { doctorId, status: "COMPLETED" },
        select: {
          npsScore: true,
          categories: true,
          comment: true,
          wouldBookAgain: true,
          respondedAt: true,
        },
        orderBy: { respondedAt: "desc" },
      }),
      prisma.satisfactionSurvey.groupBy({
        by: ["status"],
        where: { doctorId },
        _count: { id: true },
      }),
      prisma.satisfactionSurvey.findMany({
        where: { status: "COMPLETED", respondedAt: { gte: since90 } },
        select: {
          npsScore: true,
          categories: true,
          wouldBookAgain: true,
          respondedAt: true,
        },
      }),
    ]);

    const recent = responses.filter(
      (r) => r.respondedAt && r.respondedAt >= since90,
    );
    const scores = (rs: Response[]) =>
      rs.map((r) => r.npsScore).filter((n): n is number => n != null);

    const counts = { promoters: 0, passives: 0, detractors: 0 };
    for (const n of scores(responses)) {
      if (n >= 9) counts.promoters++;
      else if (n >= 7) counts.passives++;
      else counts.detractors++;
    }

    const byStatus = new Map(statusCounts.map((s) => [s.status, s._count.id]));
    const delivered =
      (byStatus.get("SENT") ?? 0) +
      (byStatus.get("COMPLETED") ?? 0) +
      (byStatus.get("EXPIRED") ?? 0);
    const responseRate = delivered
      ? Math.round((responses.length / delivered) * 100)
      : 0;

    const trend = lastMonths(6).map((m) => {
      const inMonth = responses.filter(
        (r) => r.respondedAt?.toISOString().slice(0, 7) === m.key,
      );
      return {
        month: m.key,
        label: m.label,
        nps: npsOf(scores(inMonth)),
        responses: inMonth.length,
      };
    });

    const myCategories90 = categoryAverages(recent.length ? recent : responses);
    const platformCategories90 = categoryAverages(platform90);
    const bookAgainAnswers = recent.filter((r) => r.wouldBookAgain !== null);
    const wouldBookAgainRate = bookAgainAnswers.length
      ? Math.round(
          (bookAgainAnswers.filter((r) => r.wouldBookAgain).length /
            bookAgainAnswers.length) *
            100,
        )
      : null;

    return {
      nps: npsOf(scores(responses)),
      nps90: npsOf(scores(recent)),
      platformNps90: npsOf(scores(platform90)),
      counts,
      totalResponses: responses.length,
      responseRate,
      wouldBookAgainRate,
      trend,
      categories: SURVEY_CATEGORIES.map((c) => ({
        ...c,
        mine: myCategories90[c.key],
        platform: platformCategories90[c.key],
      })),
      // Anonymized — doctors never see who said what.
      comments: responses
        .filter((r) => r.comment)
        .slice(0, 10)
        .map((r) => ({
          comment: r.comment,
          npsScore: r.npsScore,
          respondedAt: r.respondedAt,
        })),
      recommendations: this.buildRecommendations({
        totalResponses: responses.length,
        nps90: npsOf(scores(recent)),
        detractorRate90: scores(recent).length
          ? scores(recent).filter((n) => n <= 6).length / scores(recent).length
          : 0,
        wouldBookAgainRate,
        myCategories: myCategories90,
        platformCategories: platformCategories90,
      }),
    };
  }

  /** Rule-based improvement recommendations from feedback patterns. */
  private buildRecommendations(input: {
    totalResponses: number;
    nps90: number | null;
    detractorRate90: number;
    wouldBookAgainRate: number | null;
    myCategories: Record<string, number | null>;
    platformCategories: Record<string, number | null>;
  }) {
    type Rec = {
      severity: "HIGH" | "MEDIUM" | "INFO";
      key: string;
      title: string;
      detail: string;
    };
    const recs: Rec[] = [];

    if (input.totalResponses < 3) {
      return [
        {
          severity: "INFO" as const,
          key: "more_data",
          title: "Keep collecting feedback",
          detail:
            "You need a few more survey responses before reliable patterns emerge. Encourage patients to answer the post-visit survey.",
        },
      ];
    }

    for (const cat of SURVEY_CATEGORIES) {
      const mine = input.myCategories[cat.key];
      if (mine == null) continue;
      const platform = input.platformCategories[cat.key];
      if (mine < 3.5) {
        recs.push({
          severity: mine < 2.8 ? "HIGH" : "MEDIUM",
          key: `low_${cat.key}`,
          title: `${cat.label} is scoring ${mine}/5`,
          detail: CATEGORY_ADVICE[cat.key] ?? "",
        });
      } else if (platform != null && mine <= platform - 0.5) {
        recs.push({
          severity: "MEDIUM",
          key: `below_platform_${cat.key}`,
          title: `${cat.label} trails the platform average (${mine} vs ${platform})`,
          detail: CATEGORY_ADVICE[cat.key] ?? "",
        });
      }
    }

    if (input.nps90 != null && input.nps90 < 0) {
      recs.push({
        severity: "HIGH",
        key: "negative_nps",
        title: `Your 90-day NPS is ${input.nps90}`,
        detail:
          "More patients would discourage others than recommend you. Read your recent comments below and address the most repeated complaint first.",
      });
    } else if (input.detractorRate90 > 0.3) {
      recs.push({
        severity: "HIGH",
        key: "high_detractors",
        title: `${Math.round(input.detractorRate90 * 100)}% of recent patients are detractors`,
        detail:
          "A large share of patients scored their visit 6 or below. Follow up with recent low scorers and review what went wrong.",
      });
    }

    if (input.wouldBookAgainRate != null && input.wouldBookAgainRate < 60) {
      recs.push({
        severity: "MEDIUM",
        key: "low_rebook",
        title: `Only ${input.wouldBookAgainRate}% would book you again`,
        detail:
          "Repeat intent is low. Closing each consult with a clear plan and a suggested follow-up date measurably lifts rebooking.",
      });
    }

    if (!recs.length) {
      recs.push({
        severity: "INFO",
        key: "all_good",
        title: "Patients are happy — keep it up",
        detail:
          "All your feedback dimensions look healthy. Keep doing what you're doing and watch the monthly trend for any dips.",
      });
    }

    const order = { HIGH: 0, MEDIUM: 1, INFO: 2 };
    return recs
      .sort((a, b) => order[a.severity] - order[b.severity])
      .slice(0, 5);
  }

  // ─── Admin ───────────────────────────────────────────────
  async getAdminOverview() {
    const since90 = new Date(Date.now() - 90 * 86_400_000);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [responses, statusCounts] = await Promise.all([
      prisma.satisfactionSurvey.findMany({
        where: { status: "COMPLETED" },
        select: {
          doctorId: true,
          npsScore: true,
          categories: true,
          wouldBookAgain: true,
          respondedAt: true,
        },
      }),
      prisma.satisfactionSurvey.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const scores = (rs: Response[]) =>
      rs.map((r) => r.npsScore).filter((n): n is number => n != null);
    const recent90 = responses.filter(
      (r) => r.respondedAt && r.respondedAt >= since90,
    );

    const byStatus = new Map(statusCounts.map((s) => [s.status, s._count.id]));
    const delivered =
      (byStatus.get("SENT") ?? 0) +
      (byStatus.get("COMPLETED") ?? 0) +
      (byStatus.get("EXPIRED") ?? 0);

    const trend = lastMonths(6).map((m) => {
      const inMonth = responses.filter(
        (r) => r.respondedAt?.toISOString().slice(0, 7) === m.key,
      );
      return {
        month: m.key,
        label: m.label,
        nps: npsOf(scores(inMonth)),
        responses: inMonth.length,
      };
    });

    // Per-doctor NPS leaderboard (minimum 3 responses to qualify)
    const byDoctor = new Map<string, number[]>();
    for (const r of responses) {
      if (r.npsScore == null) continue;
      const list = byDoctor.get(r.doctorId) ?? [];
      list.push(r.npsScore);
      byDoctor.set(r.doctorId, list);
    }
    const qualified = [...byDoctor.entries()]
      .filter(([, s]) => s.length >= 3)
      .map(([doctorId, s]) => ({
        doctorId,
        nps: npsOf(s) ?? 0,
        responses: s.length,
      }))
      .sort((a, b) => b.nps - a.nps);
    const ids = [
      ...new Set(
        [...qualified.slice(0, 5), ...qualified.slice(-5)].map(
          (d) => d.doctorId,
        ),
      ),
    ];
    const doctors = ids.length
      ? await prisma.doctor.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, image: true, designation: true },
        })
      : [];
    const docById = new Map(doctors.map((d) => [d.id, d]));
    const enrich = (d: {
      doctorId: string;
      nps: number;
      responses: number;
    }) => ({
      ...d,
      name: docById.get(d.doctorId)?.name ?? "",
      image: docById.get(d.doctorId)?.image ?? "",
      designation: docById.get(d.doctorId)?.designation ?? "",
    });

    const detractors30d = responses.filter(
      (r) =>
        r.npsScore != null &&
        r.npsScore <= 6 &&
        r.respondedAt &&
        r.respondedAt >= since30,
    ).length;
    const bookAgain = responses.filter((r) => r.wouldBookAgain !== null);

    return {
      nps: npsOf(scores(responses)),
      nps90: npsOf(scores(recent90)),
      totalResponses: responses.length,
      delivered,
      pending: byStatus.get("PENDING") ?? 0,
      expired: byStatus.get("EXPIRED") ?? 0,
      responseRate: delivered
        ? Math.round((responses.length / delivered) * 100)
        : 0,
      detractors30d,
      wouldBookAgainRate: bookAgain.length
        ? Math.round(
            (bookAgain.filter((r) => r.wouldBookAgain).length /
              bookAgain.length) *
              100,
          )
        : null,
      categories: SURVEY_CATEGORIES.map((c) => ({
        ...c,
        average: categoryAverages(recent90.length ? recent90 : responses)[
          c.key
        ],
      })),
      trend,
      topDoctors: qualified.slice(0, 5).map(enrich),
      bottomDoctors: qualified.slice(-5).reverse().map(enrich),
    };
  }

  getAdminResponses(page = 1, limit = 20, status?: string) {
    const where =
      status && ["PENDING", "SENT", "COMPLETED", "EXPIRED"].includes(status)
        ? { status: status as "PENDING" | "SENT" | "COMPLETED" | "EXPIRED" }
        : {};
    return prisma.satisfactionSurvey.findMany({
      where,
      include: {
        user: { select: { name: true, image: true } },
        doctor: { select: { name: true, designation: true } },
        appointment: { select: { date: true, time: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
