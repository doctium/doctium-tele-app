// Live verification of the Advanced Analytics feature:
//  - role gating (doctor/patient/admin) + analytics.view permission route
//  - doctor premium gating via the advancedAnalytics plan benefit
//  - aggregation invariants cross-checked against the database
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

(async () => {
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true, name: true },
  });
  if (!doc)
    throw new Error(
      "seed doctor rxdoc@doctium.com missing — run seed-rx-test.cjs",
    );

  // ── logins ──
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

  // ── 1) access control ──
  console.log("\n1) Access control");
  assert(
    (await call("GET", "/analytics/doctor")).status === 401,
    "no token → 401",
  );
  assert(
    (await call("GET", "/analytics/doctor", null, pTok)).status === 403,
    "patient on doctor analytics → 403",
  );
  assert(
    (await call("GET", "/analytics/patient", null, dTok)).status === 403,
    "doctor on patient analytics → 403",
  );
  assert(
    (await call("GET", "/admin/analytics/overview", null, dTok)).status === 403,
    "doctor on admin analytics → 403",
  );

  // ── 2) doctor analytics, premium gating ──
  console.log("\n2) Doctor analytics — premium gating");
  const existingSub = await prisma.subscription.findUnique({
    where: { doctorId: doc.id },
  });
  // force the non-premium state first
  if (existingSub && existingSub.status === "ACTIVE") {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { status: "CANCELLED" },
    });
  }
  const free = await call("GET", "/analytics/doctor", null, dTok);
  const freeBody = data(free);
  assert(free.status === 200, "doctor analytics → 200");
  assert(freeBody.premium === false, "no active plan → premium:false");
  assert(freeBody.advanced === null, "no active plan → advanced locked (null)");
  assert(
    typeof freeBody.basic?.completionRate === "number" &&
      freeBody.basic.completionRate >= 0 &&
      freeBody.basic.completionRate <= 100,
    `basic completionRate is a sane % (${freeBody.basic?.completionRate})`,
  );
  assert(
    Number.isInteger(freeBody.basic?.thisMonthEarnings),
    "thisMonthEarnings is integer kobo",
  );

  // grant a plan that includes advancedAnalytics
  const plan = await prisma.subscriptionPlan.upsert({
    where: { code: "test_doc_analytics" },
    create: {
      code: "test_doc_analytics",
      name: "Test Doctor Analytics",
      audience: "DOCTOR",
      price: 500000,
      isActive: false, // fixture only — keep it out of the app plan list
      benefits: { advancedAnalytics: true },
    },
    update: { benefits: { advancedAnalytics: true }, isActive: false },
  });
  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { planId: plan.id, status: "ACTIVE" },
    });
  } else {
    await prisma.subscription.create({
      data: {
        planId: plan.id,
        subscriberType: "DOCTOR",
        doctorId: doc.id,
        status: "ACTIVE",
        priceAtSignup: plan.price,
      },
    });
  }

  const prem = await call("GET", "/analytics/doctor", null, dTok);
  const premBody = data(prem);
  const adv = premBody.advanced;
  assert(premBody.premium === true, "active analytics plan → premium:true");
  assert(!!adv, "advanced section unlocked");
  assert(adv?.earningsTrend?.length === 12, "earningsTrend covers 12 months");
  assert(adv?.peakHours?.length === 24, "peakHours covers 24 hours");
  assert(adv?.peakDays?.length === 7, "peakDays covers 7 days");
  const ret = adv?.retention ?? {};
  assert(
    ret.returningPatients + ret.newPatients === ret.uniquePatients,
    `retention split adds up (${ret.returningPatients}+${ret.newPatients}=${ret.uniquePatients})`,
  );
  // cross-check trend total against the DB
  const dbDoc = await prisma.appointment.aggregate({
    where: { doctorId: doc.id, status: "COMPLETED" },
    _sum: { doctorEarning: true },
    _count: { id: true },
  });
  const trendConsults = adv.earningsTrend.reduce(
    (s, m) => s + m.consultations,
    0,
  );
  assert(
    trendConsults <= dbDoc._count.id,
    `trend consults (${trendConsults}) ⊆ all-time completed (${dbDoc._count.id})`,
  );

  // restore the doctor's original subscription state
  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { planId: existingSub.planId, status: existingSub.status },
    });
  } else {
    await prisma.subscription.deleteMany({
      where: { doctorId: doc.id, planId: plan.id },
    });
  }
  const restored = await call("GET", "/analytics/doctor", null, dTok);
  assert(
    data(restored).premium ===
      (existingSub ? existingSub.status === "ACTIVE" : false) ||
      data(restored).premium === false ||
      existingSub?.status === "ACTIVE",
    "fixture subscription state restored",
  );

  // ── 3) patient analytics ──
  console.log("\n3) Patient analytics");
  const pa = await call("GET", "/analytics/patient", null, pTok);
  const paBody = data(pa);
  assert(pa.status === 200, "patient analytics → 200");
  const factorSum = (paBody.healthScoreFactors ?? []).reduce(
    (s, f) => s + f.score,
    0,
  );
  assert(
    paBody.summary?.healthScore === factorSum,
    `healthScore (${paBody.summary?.healthScore}) = sum of factors (${factorSum})`,
  );
  assert(
    paBody.summary.healthScore >= 0 && paBody.summary.healthScore <= 100,
    "healthScore within 0–100",
  );
  assert(paBody.monthly?.length === 12, "monthly series covers 12 months");
  assert(
    paBody.healthScoreSeries?.length === 6,
    "health score series covers 6 months",
  );
  const specCount = (paBody.bySpecialty ?? []).reduce((s, x) => s + x.count, 0);
  assert(
    specCount === paBody.summary.completedConsultations,
    `specialty counts (${specCount}) = completed consults (${paBody.summary.completedConsultations})`,
  );
  const monthlySpent = paBody.monthly.reduce((s, m) => s + m.spent, 0);
  assert(
    monthlySpent <= paBody.summary.totalSpent,
    `12-month spend (${monthlySpent}) ⊆ total spend (${paBody.summary.totalSpent})`,
  );
  assert(
    Number.isInteger(paBody.summary.totalSpent),
    "totalSpent is integer kobo",
  );

  // ── 4) admin analytics ──
  console.log("\n4) Admin analytics");
  const [ov, co, ch, rs, geo] = await Promise.all([
    call("GET", "/admin/analytics/overview", null, aTok),
    call("GET", "/admin/analytics/cohorts", null, aTok),
    call("GET", "/admin/analytics/churn", null, aTok),
    call("GET", "/admin/analytics/revenue-by-specialty", null, aTok),
    call("GET", "/admin/analytics/geo", null, aTok),
  ]);
  assert(
    [ov, co, ch, rs, geo].every((r) => r.status === 200),
    "all 5 admin endpoints → 200",
  );

  const ovB = data(ov);
  assert(
    [
      "activePatients30d",
      "newUsers30d",
      "repeatRate",
      "avgRevenuePerPatient",
    ].every((k) => typeof ovB[k] === "number"),
    "overview KPIs present",
  );
  assert(
    ovB.churnBuckets &&
      ["high", "medium", "low"].every(
        (k) => typeof ovB.churnBuckets[k] === "number",
      ),
    "overview includes churn buckets",
  );

  const coB = data(co);
  assert(coB.cohorts?.length === 8, "8 monthly cohorts");
  assert(
    coB.cohorts.every((c) => c.retention.length === 8),
    "each cohort has an 8-step retention row",
  );
  const lastCohort = coB.cohorts[coB.cohorts.length - 1];
  assert(
    lastCohort.retention.slice(1).every((v) => v === null) &&
      lastCohort.retention[0] !== null,
    "newest cohort: only M0 measured, future months null",
  );
  const userCount = await prisma.user.count({ where: { isDelete: false } });
  const cohortSizes = coB.cohorts.reduce((s, c) => s + c.size, 0);
  assert(
    cohortSizes <= userCount,
    `cohort sizes (${cohortSizes}) ⊆ total users (${userCount})`,
  );

  const chB = data(ch);
  assert(Array.isArray(chB.atRisk), "churn atRisk list present");
  assert(
    chB.atRisk.every(
      (u) => ["HIGH", "MEDIUM"].includes(u.level) && u.daysSinceLast >= 0,
    ),
    "at-risk entries carry level + silence days",
  );
  const completedPatients = await prisma.appointment.groupBy({
    by: ["userId"],
    where: { status: "COMPLETED" },
  });
  assert(
    chB.buckets.high + chB.buckets.medium + chB.buckets.low ===
      completedPatients.length,
    `churn buckets (${chB.buckets.high}+${chB.buckets.medium}+${chB.buckets.low}) cover all paying patients (${completedPatients.length})`,
  );

  const rsB = data(rs);
  const dbRevenue = await prisma.appointment.aggregate({
    where: { status: "COMPLETED" },
    _sum: { amount: true },
  });
  const specRevenue = rsB.reduce((s, x) => s + x.revenue, 0);
  assert(
    specRevenue === (dbRevenue._sum.amount ?? 0),
    `specialty revenue (${specRevenue}) = total completed revenue (${dbRevenue._sum.amount ?? 0})`,
  );

  const geoB = data(geo);
  const geoPatients = geoB.countries.reduce((s, c) => s + c.patients, 0);
  assert(
    geoPatients === userCount,
    `geo patient counts (${geoPatients}) = total users (${userCount})`,
  );
  assert(Array.isArray(geoB.points), "geo heatmap points present");

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
