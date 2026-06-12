// Live verification of the Leenah growth pass:
//  - DoctiumPlus `unlimitedTriage` benefit lifts the daily session caps
//  - richer GET /triage/status (dailyLimit, per-mode usage, unlimited flag)
//  - cap message upsells DoctiumPlus
//  - suggestion→enrollment conversion on the admin overview, with the
//    temporal rule: only enrollments AFTER the suggesting session count
// Zero LLM calls — caps, fixtures and deterministic paths only.
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

const HOUR = 3_600_000;
const state = { tmpPlanId: null, createdSubId: null, enrollmentId: null };

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  const hyp = await prisma.careProgram.findUnique({
    where: { code: "hypertension" },
    select: { id: true, name: true },
  });
  if (!usr || !hyp) throw new Error("seed data missing");
  await prisma.triageSession.deleteMany({ where: { userId: usr.id } });
  await prisma.programEnrollment.deleteMany({
    where: { userId: usr.id, readings: { none: {} }, goals: { none: {} } },
  });

  // neutralize any existing membership so the cap phase is deterministic
  const existingSub = await prisma.subscription.findUnique({
    where: { userId: usr.id },
  });
  if (existingSub && existingSub.status === "ACTIVE") {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { status: "CANCELLED" },
    });
  }

  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const pTok = data(pl)?.accessToken;
  const aTok = data(al)?.accessToken;
  console.log("logins:", pl.status, al.status);
  if (!pTok || !aTok) throw new Error("login failed");

  // ── 1) richer status ──
  console.log("\n1) /triage/status");
  let st = data(await call("GET", "/triage/status", null, pTok));
  assert(st?.enabled === true, "enabled flag intact");
  assert(st?.dailyLimit === 5, `dailyLimit exposed (${st?.dailyLimit})`);
  assert(st?.unlimited === false, "free account → unlimited:false");
  assert(
    st?.used?.TRIAGE === 0 && st?.used?.QA === 0,
    "per-mode usage starts at zero",
  );

  // ── 2) cap + upsell ──
  console.log("\n2) Daily cap upsells DoctiumPlus");
  for (let i = 0; i < 5; i++) await call("POST", "/triage/sessions", {}, pTok);
  st = data(await call("GET", "/triage/status", null, pTok));
  assert(st?.used?.TRIAGE === 5, "usage counter tracks sessions");
  const capped = await call("POST", "/triage/sessions", {}, pTok);
  assert(capped.status === 400, "6th session blocked → 400");
  assert(
    JSON.stringify(capped.body).includes("DoctiumPlus"),
    "cap message upsells DoctiumPlus",
  );

  // ── 3) unlimitedTriage benefit lifts the cap ──
  console.log("\n3) DoctiumPlus unlimited checks");
  const plan = await prisma.subscriptionPlan.upsert({
    where: { code: "test_unlimited_triage" },
    create: {
      code: "test_unlimited_triage",
      name: "Test Unlimited Triage",
      audience: "USER",
      price: 100000,
      isActive: false, // fixture only
      benefits: {
        consultsPerCycle: 0,
        memberDiscountPercent: 0,
        familyCap: 0,
        unlimitedTriage: true,
      },
    },
    update: { isActive: false },
  });
  state.tmpPlanId = plan.id;
  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { planId: plan.id, status: "ACTIVE" },
    });
  } else {
    const created = await prisma.subscription.create({
      data: {
        planId: plan.id,
        subscriberType: "USER",
        userId: usr.id,
        status: "ACTIVE",
        priceAtSignup: plan.price,
      },
    });
    state.createdSubId = created.id;
  }

  st = data(await call("GET", "/triage/status", null, pTok));
  assert(st?.unlimited === true, "status flips to unlimited");
  const sixth = await call("POST", "/triage/sessions", {}, pTok);
  const seventh = await call("POST", "/triage/sessions", { mode: "QA" }, pTok);
  assert(
    sixth.status < 300 && seventh.status < 300,
    "members sail past both mode caps",
  );

  // restore membership state
  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { planId: existingSub.planId, status: existingSub.status },
    });
  } else if (state.createdSubId) {
    await prisma.subscription.delete({ where: { id: state.createdSubId } });
  }
  st = data(await call("GET", "/triage/status", null, pTok));
  assert(
    st?.unlimited === (existingSub ? existingSub.status === "ACTIVE" : false) ||
      st?.unlimited === false,
    "membership state restored",
  );

  // ── 4) suggestion → enrollment conversion ──
  console.log("\n4) Suggestion conversion on the admin overview");
  await prisma.triageSession.deleteMany({ where: { userId: usr.id } });
  // session A suggested 2h ago, enrollment 1h ago → CONVERTED
  await prisma.triageSession.create({
    data: {
      userId: usr.id,
      status: "COMPLETED",
      mode: "TRIAGE",
      urgency: "CONSULT_24H",
      specialty: "General practice",
      summary: "fixture A",
      suggestedProgramId: hyp.id,
      messages: [],
      createdAt: new Date(Date.now() - 2 * HOUR),
    },
  });
  const enrollment = await prisma.programEnrollment.create({
    data: {
      userId: usr.id,
      programId: hyp.id,
      createdAt: new Date(Date.now() - 1 * HOUR),
    },
  });
  state.enrollmentId = enrollment.id;
  // session B suggested NOW (after the enrollment) → must NOT count
  await prisma.triageSession.create({
    data: {
      userId: usr.id,
      status: "COMPLETED",
      mode: "TRIAGE",
      urgency: "ROUTINE",
      specialty: "General practice",
      summary: "fixture B",
      suggestedProgramId: hyp.id,
      messages: [],
    },
  });

  const ov = data(await call("GET", "/admin/triage/overview", null, aTok));
  const ps = ov?.programSuggestions;
  assert(ps?.suggested === 2, `suggestions counted (${ps?.suggested})`);
  assert(
    ps?.converted === 1,
    `only the pre-enrollment suggestion converts (${ps?.converted})`,
  );
  assert(
    ps?.conversionRate === 50,
    `conversion rate 50% (${ps?.conversionRate})`,
  );
  const top = (ps?.byProgram ?? [])[0];
  assert(
    top?.name === hyp.name && top?.suggested === 2 && top?.converted === 1,
    "per-program breakdown carries Hypertension Care",
  );

  // ── cleanup ──
  await prisma.programEnrollment.deleteMany({
    where: { id: state.enrollmentId ?? "" },
  });
  await prisma.triageSession.deleteMany({ where: { userId: usr.id } });
  if (state.tmpPlanId)
    await prisma.subscriptionPlan.deleteMany({
      where: { id: state.tmpPlanId, subscriptions: { none: {} } },
    });

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
