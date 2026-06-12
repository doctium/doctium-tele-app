// Live verification of the Patient Satisfaction & NPS system:
//  - survey auto-queued 24h out when a consult completes (via the real status endpoint)
//  - cron delivery (manual trigger) + in-app notification + 7d expiry
//  - response validation, anonymized doctor summary, recommendation rules, admin overview
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";

const call = async (method, path, body, token) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j;
  try {
    j = await r.json();
  } catch {
    j = {};
  }
  return { status: r.status, body: j };
};
const data = (r) => r.body.data ?? r.body;

let pass = 0,
  fail = 0;
const assert = (c, l) => {
  if (c) {
    pass++;
    console.log("  ✓", l);
  } else {
    fail++;
    console.log("  ✗ FAIL:", l);
  }
};

const today = new Date().toISOString().slice(0, 10);
const cleanupApptIds = [];

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true, name: true },
  });
  if (!usr || !doc) throw new Error("seed patient/doctor missing");

  const mkAppt = (overrides = {}) =>
    prisma.appointment
      .create({
        data: {
          userId: usr.id,
          doctorId: doc.id,
          date: today,
          time: "14:30",
          status: "CONFIRMED",
          paymentStatus: "PENDING", // keeps settlement out of this test
          ...overrides,
        },
      })
      .then((a) => {
        cleanupApptIds.push(a.id);
        return a;
      });

  // logins
  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const pTok = data(pl)?.accessToken;
  const dTok = data(dl)?.accessToken;
  const aTok = data(al)?.accessToken;
  console.log("logins:", pl.status, dl.status, al.status);
  if (!pTok || !dTok || !aTok) throw new Error("login failed");

  // ── 1) survey auto-queued on completion ──
  console.log("\n1) Auto-queue on consult completion");
  const appt = await mkAppt();
  const done = await call(
    "PATCH",
    `/appointments/${appt.id}/status`,
    { status: "COMPLETED" },
    dTok,
  );
  assert(done.status < 300, `consult marked COMPLETED (${done.status})`);
  await new Promise((r) => setTimeout(r, 800)); // fire-and-forget hook
  let survey = await prisma.satisfactionSurvey.findUnique({
    where: { appointmentId: appt.id },
  });
  assert(!!survey, "survey row created for the appointment");
  assert(survey?.status === "PENDING", "survey starts PENDING");
  const hoursOut = survey
    ? (survey.scheduledFor.getTime() - Date.now()) / 3600_000
    : 0;
  assert(
    hoursOut > 23 && hoursOut < 25,
    `scheduled ~24h out (${hoursOut.toFixed(1)}h)`,
  );

  // re-completing must not duplicate
  await call(
    "PATCH",
    `/appointments/${appt.id}/status`,
    { status: "COMPLETED" },
    dTok,
  );
  await new Promise((r) => setTimeout(r, 500));
  const count = await prisma.satisfactionSurvey.count({
    where: { appointmentId: appt.id },
  });
  assert(count === 1, "idempotent — still exactly one survey");

  // ── 2) delivery via cron trigger ──
  console.log("\n2) Delivery + notification");
  await prisma.satisfactionSurvey.update({
    where: { id: survey.id },
    data: { scheduledFor: new Date(Date.now() - 60_000) },
  });
  const run = await call("POST", "/admin/satisfaction/run", {}, aTok);
  assert(run.status < 300, `manual cron trigger (${run.status})`);
  survey = await prisma.satisfactionSurvey.findUnique({
    where: { id: survey.id },
  });
  assert(survey?.status === "SENT", "survey delivered → SENT");
  const notif = await prisma.notification.findFirst({
    where: { userId: usr.id, type: "satisfaction_survey" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    !!notif && notif.message.includes(doc.name),
    "in-app notification created, names the doctor",
  );

  // patient sees it as open
  const mine = await call("GET", "/satisfaction/mine", null, pTok);
  assert(
    (data(mine)?.open ?? []).some((s) => s.id === survey.id),
    "patient sees the survey in their open list",
  );
  assert(
    (data(mine)?.categories ?? []).length === 4,
    "category catalog shipped with the form (4 dimensions)",
  );

  // ── 3) response validation + access control ──
  console.log("\n3) Responding");
  assert(
    (
      await call(
        "POST",
        `/satisfaction/${survey.id}/respond`,
        { npsScore: 9 },
        dTok,
      )
    ).status === 403,
    "doctor cannot answer a patient survey → 403",
  );
  assert(
    (
      await call(
        "POST",
        `/satisfaction/${survey.id}/respond`,
        { npsScore: 11 },
        pTok,
      )
    ).status === 400,
    "npsScore 11 rejected → 400",
  );
  assert(
    (
      await call(
        "POST",
        `/satisfaction/${survey.id}/respond`,
        { npsScore: 9, categories: { communication: 7 } },
        pTok,
      )
    ).status === 400,
    "category value 7 rejected → 400",
  );

  const ok = await call(
    "POST",
    `/satisfaction/${survey.id}/respond`,
    {
      npsScore: 9,
      categories: {
        communication: 5,
        waitTime: 4,
        diagnosisClarity: 5,
        careQuality: 5,
        bogus: 5,
      },
      comment: "Very clear explanation, thank you!",
      wouldBookAgain: true,
    },
    pTok,
  );
  assert(ok.status < 300, `valid response accepted (${ok.status})`);
  survey = await prisma.satisfactionSurvey.findUnique({
    where: { id: survey.id },
  });
  assert(
    survey?.status === "COMPLETED" && survey?.npsScore === 9,
    "stored: COMPLETED, nps 9",
  );
  assert(
    survey?.categories &&
      !("bogus" in survey.categories) &&
      survey.categories.waitTime === 4,
    "unknown category keys dropped, valid ones stored",
  );
  assert(
    (
      await call(
        "POST",
        `/satisfaction/${survey.id}/respond`,
        { npsScore: 2 },
        pTok,
      )
    ).status === 400,
    "double-respond rejected → 400",
  );

  // ── 4) doctor summary: anonymity + recommendation rules ──
  console.log("\n4) Doctor summary & recommendations");
  // seed 3 more detractor responses with weak communication to trip the rules
  for (let i = 0; i < 3; i++) {
    const a = await mkAppt({ time: `0${i + 1}:00`, status: "COMPLETED" });
    await prisma.satisfactionSurvey.create({
      data: {
        appointmentId: a.id,
        userId: usr.id,
        doctorId: doc.id,
        status: "COMPLETED",
        scheduledFor: new Date(),
        sentAt: new Date(),
        respondedAt: new Date(),
        npsScore: 3,
        categories: {
          communication: 2,
          waitTime: 2,
          diagnosisClarity: 2,
          careQuality: 2,
        },
        comment: i === 0 ? "Felt rushed." : "",
        wouldBookAgain: false,
      },
    });
  }
  const summary = await call("GET", "/satisfaction/doctor/summary", null, dTok);
  const sm = data(summary);
  assert(summary.status === 200, "doctor summary → 200");
  assert(sm.totalResponses >= 4, `responses aggregated (${sm.totalResponses})`);
  // 1 promoter (9) vs 3 detractors (3,3,3) → negative NPS
  assert(
    typeof sm.nps === "number" && sm.nps < 0,
    `NPS computed and negative (${sm.nps})`,
  );
  assert(
    sm.counts.promoters >= 1 && sm.counts.detractors >= 3,
    "promoter/detractor counts split correctly",
  );
  assert(
    (sm.categories ?? []).length === 4 &&
      sm.categories.every((c) => typeof c.mine === "number"),
    "4 category averages with platform benchmark",
  );
  assert(
    (sm.comments ?? []).every(
      (c) => !("name" in c) && !("userId" in c) && !("email" in c),
    ),
    "comments are anonymized (no patient identity)",
  );
  const recKeys = (sm.recommendations ?? []).map((r) => r.key).join(",");
  assert(
    (sm.recommendations ?? []).some((r) => r.severity === "HIGH"),
    `HIGH-severity recommendation emitted (${recKeys})`,
  );
  assert(
    (sm.recommendations ?? []).some(
      (r) => r.key.includes("communication") || r.key === "negative_nps",
    ),
    "rule fired for weak communication / negative NPS",
  );

  // ── 5) expiry ──
  console.log("\n5) Expiry of unanswered surveys");
  const staleAppt = await mkAppt({ time: "09:00", status: "COMPLETED" });
  const stale = await prisma.satisfactionSurvey.create({
    data: {
      appointmentId: staleAppt.id,
      userId: usr.id,
      doctorId: doc.id,
      status: "SENT",
      scheduledFor: new Date(Date.now() - 9 * 86_400_000),
      sentAt: new Date(Date.now() - 8 * 86_400_000),
    },
  });
  await call("POST", "/admin/satisfaction/run", {}, aTok);
  const expired = await prisma.satisfactionSurvey.findUnique({
    where: { id: stale.id },
  });
  assert(
    expired?.status === "EXPIRED",
    "unanswered survey expired after 7d window",
  );

  // ── 6) admin overview + responses ──
  console.log("\n6) Admin overview");
  const ov = await call("GET", "/admin/satisfaction/overview", null, aTok);
  const ovB = data(ov);
  assert(ov.status === 200, "admin overview → 200");
  assert(typeof ovB.nps === "number", `platform NPS present (${ovB.nps})`);
  assert(ovB.trend?.length === 6, "6-month NPS trend");
  assert(
    ovB.categories?.length === 4 &&
      ovB.responseRate >= 0 &&
      ovB.responseRate <= 100,
    "category averages + sane response rate",
  );
  assert(
    [...(ovB.topDoctors ?? []), ...(ovB.bottomDoctors ?? [])].some(
      (d) => d.doctorId === doc.id,
    ),
    "test doctor appears on the NPS leaderboard (≥3 responses)",
  );
  const list = await call(
    "GET",
    "/admin/satisfaction/responses?status=COMPLETED",
    null,
    aTok,
  );
  const rows = data(list) ?? [];
  assert(
    rows.some((r) => r.user?.name && r.doctor?.name),
    "admin response list carries identities (unlike doctor view)",
  );
  assert(
    (await call("GET", "/admin/satisfaction/overview", null, dTok)).status ===
      403,
    "doctor blocked from admin satisfaction → 403",
  );

  // ── 7) detractor feeds churn risk (analytics integration) ──
  console.log("\n7) Detractor → churn-risk integration");
  const churn = await call("GET", "/admin/analytics/churn", null, aTok);
  const churnB = data(churn);
  assert(churn.status === 200, "admin churn endpoint → 200");
  const me = (churnB.atRisk ?? []).find((u) => u.userId === usr.id);
  assert(!!me, "test patient surfaces on the at-risk list (detractor bump)");
  assert(
    me?.detractor === true && me?.npsScore <= 6,
    `flagged as detractor with NPS ${me?.npsScore}/10`,
  );
  assert(
    ["HIGH", "MEDIUM"].includes(me?.level),
    `risk level raised by feedback signal (${me?.level})`,
  );

  // ── cleanup ──
  await prisma.satisfactionSurvey.deleteMany({
    where: { appointmentId: { in: cleanupApptIds } },
  });
  await prisma.followUp.deleteMany({
    where: { appointmentId: { in: cleanupApptIds } },
  });
  await prisma.appointment.deleteMany({
    where: { id: { in: cleanupApptIds } },
  });
  console.log(`\ncleaned up ${cleanupApptIds.length} fixture appointments`);

  console.log(`${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  try {
    await prisma.satisfactionSurvey.deleteMany({
      where: { appointmentId: { in: cleanupApptIds } },
    });
    await prisma.followUp.deleteMany({
      where: { appointmentId: { in: cleanupApptIds } },
    });
    await prisma.appointment.deleteMany({
      where: { id: { in: cleanupApptIds } },
    });
  } catch {}
  await prisma.$disconnect();
  process.exit(1);
});
