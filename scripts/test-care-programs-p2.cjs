// Live verification of Chronic Disease Management Phase 2 (engagement layer):
//  - goals: care-lead CRUD, validation, startValue snapshot, progress math,
//    auto-ACHIEVED on reading, due-date expiry → MISSED, cancel
//  - adherence scoring (readings vs program cadence) on detail/cohort/admin
//  - cadence check-ins: silent advance when engaged, nudge when quiet
//  - silent-patient escalation to patient + care lead, weekly re-escalation cap
// Run AFTER scripts/seed-care-programs.cjs (uses the seeded hypertension program).
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

const DAY = 86_400_000;
let enrollmentId = null;

const cleanup = async () => {
  if (!enrollmentId) return;
  await prisma.programGoal.deleteMany({ where: { enrollmentId } });
  await prisma.vitalAlert.deleteMany({ where: { enrollmentId } });
  await prisma.vitalReading.deleteMany({ where: { enrollmentId } });
  await prisma.programEnrollment.deleteMany({ where: { id: enrollmentId } });
};

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const program = await prisma.careProgram.findUnique({
    where: { code: "hypertension" },
  });
  if (!usr || !doc) throw new Error("seed patient/doctor missing");
  if (!program) throw new Error("run scripts/seed-care-programs.cjs first");
  // clean slate
  const old = await prisma.programEnrollment.findMany({
    where: { userId: usr.id, programId: program.id },
    select: { id: true },
  });
  for (const e of old) {
    await prisma.programGoal.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.vitalAlert.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.vitalReading.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.programEnrollment.delete({ where: { id: e.id } });
  }

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

  const en = await call(
    "POST",
    `/care-programs/${program.id}/enroll`,
    { doctorId: doc.id },
    pTok,
  );
  enrollmentId = data(en)?.id;
  if (!enrollmentId) throw new Error("enrollment failed");

  const log = (v, v2) =>
    call(
      "POST",
      `/care-programs/enrollments/${enrollmentId}/readings`,
      { type: "BLOOD_PRESSURE", value: v, value2: v2 },
      pTok,
    );
  const notifCount = (type, who = "user") =>
    prisma.notification.count({
      where:
        who === "user" ? { userId: usr.id, type } : { doctorId: doc.id, type },
    });

  // ── 1) goals: creation + validation ──
  console.log("\n1) Goal creation");
  await log(150, 95); // baseline reading first, so startValue snapshots it
  assert(
    (
      await call(
        "POST",
        `/care-programs/enrollments/${enrollmentId}/goals`,
        { type: "BLOOD_PRESSURE", direction: "AT_OR_BELOW", targetValue: 130 },
        pTok,
      )
    ).status === 403,
    "patient cannot create goals → 403",
  );
  assert(
    (
      await call(
        "POST",
        `/care-programs/enrollments/${enrollmentId}/goals`,
        { type: "SPO2", direction: "AT_OR_ABOVE", targetValue: 95 },
        dTok,
      )
    ).status === 400,
    "goal for untracked vital → 400",
  );
  assert(
    (
      await call(
        "POST",
        `/care-programs/enrollments/${enrollmentId}/goals`,
        { type: "BLOOD_PRESSURE", direction: "SIDEWAYS", targetValue: 130 },
        dTok,
      )
    ).status === 400,
    "invalid direction → 400",
  );

  const g1 = await call(
    "POST",
    `/care-programs/enrollments/${enrollmentId}/goals`,
    {
      type: "BLOOD_PRESSURE",
      direction: "AT_OR_BELOW",
      targetValue: 130,
      targetValue2: 85,
      dueDate: new Date(Date.now() + 30 * DAY).toISOString(),
    },
    dTok,
  );
  const goal1 = data(g1);
  assert(
    g1.status < 300 && goal1?.status === "ACTIVE",
    "care lead creates a BP goal",
  );
  assert(
    goal1?.startValue === 150 && goal1?.startValue2 === 95,
    "startValue snapshots latest reading (150/95)",
  );
  assert(
    goal1?.title.includes("130/85"),
    `auto-title generated ("${goal1?.title}")`,
  );
  assert(
    (await notifCount("care_goal")) >= 1,
    "patient notified of the new goal",
  );

  // ── 2) progress + auto-achieve ──
  console.log("\n2) Progress & auto-achieve");
  await log(140, 90); // halfway: (150-140)/(150-130) = 50%
  let detail = data(
    await call("GET", `/care-programs/enrollments/${enrollmentId}`, null, pTok),
  );
  let dGoal = (detail.goals ?? []).find((g) => g.id === goal1.id);
  assert(
    dGoal?.progress === 50,
    `progress 50% at 140 systolic (got ${dGoal?.progress})`,
  );

  const hit = await log(128, 82);
  assert(
    (data(hit)?.achievedGoals ?? []).length === 1,
    "log response reports the achieved goal",
  );
  const g1row = await prisma.programGoal.findUnique({
    where: { id: goal1.id },
  });
  assert(
    g1row?.status === "ACHIEVED" && !!g1row?.achievedAt,
    "goal flipped to ACHIEVED",
  );
  assert(
    (await notifCount("care_goal_achieved")) >= 1,
    "patient gets the 🎉 notification",
  );
  assert(
    (await notifCount("care_goal_achieved", "doctor")) >= 1,
    "care lead notified too",
  );

  // ── 3) adherence ──
  console.log("\n3) Adherence");
  // 3 BP readings this week vs cadence 7 (BP) + 1 (weight) = 8 → 38%
  detail = data(
    await call("GET", `/care-programs/enrollments/${enrollmentId}`, null, pTok),
  );
  assert(
    detail.adherence?.expectedPerWeek === 8 && detail.adherence?.percent === 38,
    `detail adherence 3/8 → 38% (got ${detail.adherence?.percent})`,
  );
  const cohort = data(
    await call("GET", "/care-programs/doctor/cohort", null, dTok),
  );
  const member = (cohort.cohort ?? []).find((c) => c.id === enrollmentId);
  assert(
    member?.adherence?.percent === 38,
    "cohort row carries the same adherence",
  );
  const mine = data(await call("GET", "/care-programs/mine", null, pTok));
  const mineE = (mine.enrollments ?? []).find((e) => e.id === enrollmentId);
  assert(mineE?.adherence?.percent === 38, "patient hub carries adherence");

  // ── 4) check-ins: engaged patient → silent advance ──
  console.log("\n4) Check-ins (engaged)");
  await prisma.programEnrollment.update({
    where: { id: enrollmentId },
    data: { lastCheckInAt: new Date(Date.now() - 8 * DAY) },
  });
  const beforeA = await notifCount("care_checkin");
  const runA = await call("POST", "/admin/care-programs/run", {}, aTok);
  assert(runA.status < 300, `manual engagement run (${runA.status})`);
  assert(
    data(runA)?.checkInsSkipped >= 1,
    "engaged patient counted as silent advance",
  );
  assert(
    (await notifCount("care_checkin")) === beforeA,
    "no nag for a patient already logging",
  );
  const afterA = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
  });
  assert(
    afterA?.lastCheckInAt &&
      Date.now() - afterA.lastCheckInAt.getTime() < 120_000,
    "check-in clock advanced silently",
  );

  // ── 5) check-ins + escalation: quiet patient ──
  console.log("\n5) Check-ins + escalation (quiet)");
  // goal2: not met, already past due → the run should flip it to MISSED
  const g2 = data(
    await call(
      "POST",
      `/care-programs/enrollments/${enrollmentId}/goals`,
      {
        type: "BLOOD_PRESSURE",
        direction: "AT_OR_BELOW",
        targetValue: 100,
        dueDate: new Date(Date.now() - 1 * DAY).toISOString(),
      },
      dTok,
    ),
  );
  await prisma.vitalReading.updateMany({
    where: { enrollmentId },
    data: { takenAt: new Date(Date.now() - 20 * DAY) },
  });
  await prisma.programEnrollment.update({
    where: { id: enrollmentId },
    data: {
      startedAt: new Date(Date.now() - 20 * DAY),
      lastCheckInAt: new Date(Date.now() - 8 * DAY),
      lastEscalationAt: null,
    },
  });
  const beforeB = await notifCount("care_checkin");
  const beforeEscU = await notifCount("care_escalation");
  const runB = data(await call("POST", "/admin/care-programs/run", {}, aTok));
  assert(runB?.checkInsSent >= 1, "quiet patient gets the check-in nudge");
  assert(
    (await notifCount("care_checkin")) === beforeB + 1,
    "care_checkin notification delivered",
  );
  assert(runB?.escalations >= 1, "silence > 2× cadence escalates");
  assert(
    (await notifCount("care_escalation")) === beforeEscU + 1,
    "patient gets the stronger nudge",
  );
  assert(
    (await notifCount("care_escalation", "doctor")) >= 1,
    "care lead told the patient has gone quiet",
  );
  assert(runB?.goalsMissed >= 1, "past-due goal swept");
  const g2row = await prisma.programGoal.findUnique({ where: { id: g2.id } });
  assert(g2row?.status === "MISSED", "unmet goal past due → MISSED");

  // immediate re-run: nothing should fire again
  const beforeC =
    (await notifCount("care_checkin")) + (await notifCount("care_escalation"));
  const runC = data(await call("POST", "/admin/care-programs/run", {}, aTok));
  const afterC =
    (await notifCount("care_checkin")) + (await notifCount("care_escalation"));
  assert(
    afterC === beforeC && (runC?.escalations ?? 0) === 0,
    "re-run within cooldowns sends nothing (no spam)",
  );

  // ── 6) cancel + gates ──
  console.log("\n6) Cancel & gates");
  const g3 = data(
    await call(
      "POST",
      `/care-programs/enrollments/${enrollmentId}/goals`,
      { type: "WEIGHT", direction: "AT_OR_BELOW", targetValue: 80 },
      dTok,
    ),
  );
  assert(
    (await call("POST", `/care-programs/goals/${g3.id}/cancel`, {}, pTok))
      .status === 403,
    "patient cannot cancel goals → 403",
  );
  const cancelled = data(
    await call("POST", `/care-programs/goals/${g3.id}/cancel`, {}, dTok),
  );
  assert(cancelled?.status === "CANCELLED", "care lead cancels a goal");
  assert(
    (await call("POST", "/admin/care-programs/run", {}, dTok)).status === 403,
    "doctor blocked from the admin trigger → 403",
  );

  // ── 7) admin overview additions ──
  console.log("\n7) Admin overview");
  const ov = data(
    await call("GET", "/admin/care-programs/overview", null, aTok),
  );
  assert(
    ov.avgAdherence === null || typeof ov.avgAdherence === "number",
    `avgAdherence reported (${ov.avgAdherence})`,
  );
  assert(
    ov.goals && ov.goals.achieved >= 1 && ov.goals.missed >= 1,
    `goal funnel reported (active ${ov.goals?.active}, achieved ${ov.goals?.achieved}, missed ${ov.goals?.missed})`,
  );

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  try {
    await cleanup();
  } catch {}
  await prisma.$disconnect();
  process.exit(1);
});
