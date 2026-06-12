/**
 * SCD Phase 4 verification — explainable crisis-risk engine, daily care-agent
 * sweep (nudges + escalation + cooldowns), and the pre-visit doctor brief.
 *
 * Run: node --env-file=.env scripts/test-risk-agent.cjs   (API up on :3001, programs seeded)
 */
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
const assert = (cond, label) => {
  if (cond) {
    pass++;
    console.log("  ✓", label);
  } else {
    fail++;
    console.log("  ✗ FAIL:", label);
  }
};

let patientId = null;
let originalGenotype = null;
const apptIds = [];

const cleanup = async () => {
  if (!patientId) return;
  const enr = await prisma.programEnrollment.findMany({
    where: {
      userId: patientId,
      program: { code: { in: ["sickle_cell", "hypertension"] } },
    },
    select: { id: true },
  });
  const ids = enr.map((e) => e.id);
  if (ids.length) {
    await prisma.vitalReading.deleteMany({
      where: { enrollmentId: { in: ids } },
    });
    await prisma.programEnrollment.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.notification.deleteMany({
    where: { type: { in: ["care_risk", "crisis_logged"] } },
  });
  if (apptIds.length) {
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  }
  if (originalGenotype !== null) {
    await prisma.healthProfile.updateMany({
      where: { userId: patientId, subPatientId: null },
      data: { genotype: originalGenotype },
    });
  }
};

(async () => {
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const patient = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  if (!doc || !patient) throw new Error("Seeds missing (rxdoc / 08000000002).");
  patientId = patient.id;
  const profile = await prisma.healthProfile.findFirst({
    where: { userId: patient.id, subPatientId: null },
    select: { genotype: true },
  });
  originalGenotype = profile?.genotype ?? "";

  await cleanup();

  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const doctorToken = data(dl)?.accessToken;
  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const patientToken = data(pl)?.accessToken;
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const adminToken = data(al)?.accessToken;
  console.log(
    "Logins — doctor:",
    dl.status,
    "patient:",
    pl.status,
    "admin:",
    al.status,
  );
  if (!doctorToken || !patientToken || !adminToken)
    throw new Error("Login failed");

  const scd = await prisma.careProgram.findUnique({
    where: { code: "sickle_cell" },
    select: { id: true },
  });
  const htn = await prisma.careProgram.findUnique({
    where: { code: "hypertension" },
    select: { id: true },
  });
  if (!scd || !htn) throw new Error("Programs not seeded");

  // An appointment for the brief tests (owned by rxdoc)
  const appt = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doc.id,
      date: "2026-06-12",
      time: "10:00",
      status: "CONFIRMED",
    },
    select: { id: true },
  });
  apptIds.push(appt.id);

  // ── 1. Brief without a crisis-tracked program → 404 ──────
  console.log("\n1) Brief preconditions");
  const noBrief = await call(
    "GET",
    `/care-programs/brief/${appt.id}`,
    null,
    doctorToken,
  );
  assert(noBrief.status === 404, "no crisis-tracked enrollment → 404");
  const briefAsPatient = await call(
    "GET",
    `/care-programs/brief/${appt.id}`,
    null,
    patientToken,
  );
  assert(briefAsPatient.status === 403, "patient role blocked (403)");

  // ── 2. Risk model scoping ─────────────────────────────────
  console.log("\n2) Risk model scoping");
  const htnEnroll = data(
    await call(
      "POST",
      `/care-programs/${htn.id}/enroll`,
      { doctorId: doc.id },
      patientToken,
    ),
  );
  const htnDetail = data(
    await call(
      "GET",
      `/care-programs/enrollments/${htnEnroll.id}`,
      null,
      patientToken,
    ),
  );
  assert(
    htnDetail?.risk == null,
    "non-crisis program (hypertension) gets no risk model",
  );

  const enrollment = data(
    await call(
      "POST",
      `/care-programs/${scd.id}/enroll`,
      { genotype: "SS", doctorId: doc.id },
      patientToken,
    ),
  );
  assert(!!enrollment?.id, "SCD enrollment created");

  // ── 3. Quiet baseline vs healthy logging ──────────────────
  console.log("\n3) Risk levels");
  // Healthy logs: hydration on target + good SpO2 → nothing should fire.
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/readings`,
    { type: "HYDRATION", value: 9 },
    patientToken,
  );
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/readings`,
    { type: "SPO2", value: 96 },
    patientToken,
  );
  const calm = data(
    await call(
      "GET",
      `/care-programs/enrollments/${enrollment.id}`,
      null,
      patientToken,
    ),
  );
  assert(
    calm?.risk?.score === 0 && calm?.risk?.level === "LOW",
    `healthy logging → score 0, LOW (got ${calm?.risk?.score})`,
  );

  // Now stack real signals: a severe crisis + two dehydrated days.
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/crises`,
    { painScore: 8, triggers: ["Dehydration"], hospitalized: false },
    patientToken,
  );
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/readings`,
    { type: "HYDRATION", value: 5 },
    patientToken,
  );
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/readings`,
    { type: "HYDRATION", value: 4 },
    patientToken,
  );
  const hot = data(
    await call(
      "GET",
      `/care-programs/enrollments/${enrollment.id}`,
      null,
      patientToken,
    ),
  );
  const keys = (hot?.risk?.factors ?? []).map((f) => f.key);
  assert(
    hot?.risk?.level === "CRITICAL" && hot?.risk?.score >= 70,
    `crisis + pain + dehydration → CRITICAL (score ${hot?.risk?.score})`,
  );
  assert(
    keys.includes("crisisRecent") &&
      keys.includes("painCritical") &&
      keys.includes("hydrationLow"),
    `factors are explainable: ${keys.join(", ")}`,
  );

  // ── 4. Care-agent sweep ───────────────────────────────────
  console.log("\n4) Care-agent sweep");
  const notifsBefore = await prisma.notification.count({
    where: { userId: patient.id, type: "care_risk" },
  });
  const sweep1 = data(
    await call("POST", "/admin/care-programs/run-risk", {}, adminToken),
  );
  assert(sweep1?.assessed >= 1, `sweep assessed ${sweep1?.assessed}`);
  assert(sweep1?.notified >= 1, `sweep notified ${sweep1?.notified}`);
  const rows = await prisma.riskAssessment.findMany({
    where: { enrollmentId: enrollment.id },
  });
  assert(
    rows.length === 1 && rows[0].level === "CRITICAL",
    "assessment persisted (CRITICAL)",
  );
  const patientNudges = await prisma.notification.count({
    where: { userId: patient.id, type: "care_risk" },
  });
  assert(patientNudges === notifsBefore + 1, "patient nudged once");
  const docEscalation = await prisma.notification.findFirst({
    where: { doctorId: doc.id, type: "care_risk" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    !!docEscalation && docEscalation.message.includes("/100"),
    "care lead escalation includes the score",
  );
  const enrAfter = await prisma.programEnrollment.findUnique({
    where: { id: enrollment.id },
    select: { lastRiskAlertAt: true },
  });
  assert(!!enrAfter?.lastRiskAlertAt, "48h cooldown timestamp set");

  // Same-day re-run: nothing new — one assessment per day.
  const sweep2 = data(
    await call("POST", "/admin/care-programs/run-risk", {}, adminToken),
  );
  const rows2 = await prisma.riskAssessment.count({
    where: { enrollmentId: enrollment.id },
  });
  assert(rows2 === 1, "same-day re-run adds no duplicate assessment");

  // Cooldown: clear today's row so it re-assesses, but keep lastRiskAlertAt —
  // patient must NOT be nudged again within 48h.
  await prisma.riskAssessment.deleteMany({
    where: { enrollmentId: enrollment.id },
  });
  await call("POST", "/admin/care-programs/run-risk", {}, adminToken);
  const nudgesAfterCooldown = await prisma.notification.count({
    where: { userId: patient.id, type: "care_risk" },
  });
  assert(
    nudgesAfterCooldown === patientNudges,
    "48h cooldown suppresses repeat nudges",
  );
  const detailWithHistory = data(
    await call(
      "GET",
      `/care-programs/enrollments/${enrollment.id}`,
      null,
      doctorToken,
    ),
  );
  assert(
    (detailWithHistory?.riskHistory ?? []).length >= 1,
    "risk history (trend) returned in detail",
  );

  // ── 5. Doctor cohort risk badge ───────────────────────────
  console.log("\n5) Cohort risk badge");
  const cohort = data(
    await call("GET", "/care-programs/doctor/cohort", null, doctorToken),
  );
  const row = (cohort?.cohort ?? []).find((r) => r.id === enrollment.id);
  assert(
    row?.risk?.level === "CRITICAL",
    "cohort row carries the live risk badge",
  );
  const htnRow = (cohort?.cohort ?? []).find((r) => r.id === htnEnroll.id);
  assert(
    htnRow && htnRow.risk == null,
    "non-crisis program rows carry no risk",
  );

  // ── 6. Pre-visit brief (the flywheel) ─────────────────────
  console.log("\n6) Pre-visit brief");
  const brief = data(
    await call("GET", `/care-programs/brief/${appt.id}`, null, doctorToken),
  );
  assert(brief?.genotype === "SS", "brief carries genotype");
  assert(brief?.risk?.level === "CRITICAL", "brief carries live risk");
  assert(brief?.crisisStats?.count90d === 1, "brief carries crisis picture");
  assert(
    typeof brief?.summary === "string" &&
      brief.summary.includes("Genotype SS") &&
      brief.summary.includes("CRITICAL"),
    `one-line summary reads well: "${brief?.summary}"`,
  );
  const ghostBrief = await call(
    "GET",
    "/care-programs/brief/not-an-appointment",
    null,
    doctorToken,
  );
  assert(ghostBrief.status === 404, "unknown appointment → 404");

  console.log(`\nDone. pass=${pass} fail=${fail}`);
  await cleanup();
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("FATAL:", e.message);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
