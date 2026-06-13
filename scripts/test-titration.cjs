/**
 * SCD Phase 5 verification — hydroxyurea titration support: doctor-only dose
 * log, CBC safety flags (myelotoxicity hold signals to the doctor, never
 * dosing advice to the patient), CBC-overdue + titration-review-due detection,
 * throttled lab reminders, and the dose-response history.
 *
 * Run: node --env-file=.env scripts/test-titration.cjs   (API up on :3001, programs seeded)
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
// Notification copy is localized; pin English so message-text asserts are stable.
let originalLanguage = null;

const cleanup = async () => {
  if (!patientId) return;
  const enr = await prisma.programEnrollment.findMany({
    where: { userId: patientId, program: { code: "sickle_cell" } },
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
    where: {
      type: {
        in: ["care_dose", "lab_alert", "lab_due", "crisis_logged", "care_risk"],
      },
    },
  });
  if (originalGenotype !== null) {
    await prisma.healthProfile.updateMany({
      where: { userId: patientId, subPatientId: null },
      data: { genotype: originalGenotype },
    });
  }
  if (originalLanguage !== null) {
    await prisma.user.update({
      where: { id: patientId },
      data: { preferredLanguage: originalLanguage },
    });
  }
};

const DAY = 86_400_000;

(async () => {
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const patient = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, preferredLanguage: true },
  });
  if (!doc || !patient) throw new Error("Seeds missing (rxdoc / 08000000002).");
  patientId = patient.id;
  const profile = await prisma.healthProfile.findFirst({
    where: { userId: patient.id, subPatientId: null },
    select: { genotype: true },
  });
  originalGenotype = profile?.genotype ?? "";
  originalLanguage = patient.preferredLanguage ?? "en";

  await cleanup();

  // Pin English (after the opening cleanup, which would otherwise restore it)
  // so the notification-copy assertions below are deterministic regardless of
  // what language another suite left the patient on.
  await prisma.user.update({
    where: { id: patient.id },
    data: { preferredLanguage: "en" },
  });

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
  const enrollment = data(
    await call(
      "POST",
      `/care-programs/${scd.id}/enroll`,
      { genotype: "SS", doctorId: doc.id },
      patientToken,
    ),
  );
  if (!enrollment?.id) throw new Error("Enrollment failed");

  // ── 1. Dose authority ─────────────────────────────────────
  console.log("\n1) Dose authority");
  const patientDose = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/doses`,
    { doseMgPerDay: 1000 },
    patientToken,
  );
  assert(patientDose.status === 403, "patient cannot set a dose (403)");
  const dosed = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/doses`,
    { doseMgPerDay: 1000, weightKg: 50, note: "starting dose" },
    doctorToken,
  );
  assert(
    dosed.status === 200 || dosed.status === 201,
    `care lead set 1000 mg/day (${dosed.status})`,
  );
  // notifyUser is fire-and-forget — poll briefly instead of racing it.
  let doseNotif = null;
  for (let i = 0; i < 10 && !doseNotif; i++) {
    doseNotif = await prisma.notification.findFirst({
      where: { userId: patient.id, type: "care_dose" },
    });
    if (!doseNotif) await new Promise((r) => setTimeout(r, 300));
  }
  assert(!!doseNotif, "patient notified of dose change");

  let t = data(
    await call(
      "GET",
      `/care-programs/enrollments/${enrollment.id}/titration`,
      null,
      doctorToken,
    ),
  );
  assert(t?.currentDose?.doseMgPerDay === 1000, "current dose reported");
  assert(t?.mgPerKg === 20, `mg/kg computed (${t?.mgPerKg})`);
  assert(t?.maxDailyMg === 1750, `MTD ceiling = 35 mg/kg (${t?.maxDailyMg})`);

  // ── 2. Safe labs ──────────────────────────────────────────
  console.log("\n2) Safe CBC");
  const safe = data(
    await call(
      "POST",
      `/care-programs/enrollments/${enrollment.id}/labs`,
      { hb: 8.5, wbc: 6.2, anc: 3.4, platelets: 250, mcv: 92 },
      patientToken,
    ),
  );
  assert((safe?.flags ?? []).length === 0, "safe counts raise no flags");
  assert(safe?.lab?.source === "PATIENT", "patient entry attributed");

  // A crisis during this dose period — for the dose-response check later.
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/crises`,
    { painScore: 6, triggers: ["Stress"] },
    patientToken,
  );

  // ── 3. Myelotoxicity flags ────────────────────────────────
  console.log("\n3) Safety flags");
  const warn = data(
    await call(
      "POST",
      `/care-programs/enrollments/${enrollment.id}/labs`,
      { anc: 1.2, platelets: 70 },
      doctorToken,
    ),
  );
  const warnKeys = (warn?.flags ?? []).map((f) => f.key);
  assert(
    warnKeys.includes("ancLow") && warnKeys.includes("plateletsLow"),
    `neutropenia + thrombocytopenia flagged (${warnKeys.join(", ")})`,
  );
  assert(
    (warn?.flags ?? []).every((f) => f.severity === "WARNING"),
    "borderline counts are WARNING tier",
  );
  const crit = data(
    await call(
      "POST",
      `/care-programs/enrollments/${enrollment.id}/labs`,
      { anc: 0.8 },
      doctorToken,
    ),
  );
  assert(
    (crit?.flags ?? []).some(
      (f) => f.key === "ancCritical" && f.severity === "CRITICAL",
    ),
    "ANC < 1.0 → CRITICAL hold-dose flag",
  );
  const docAlert = await prisma.notification.findFirst({
    where: { doctorId: doc.id, type: "lab_alert" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    !!docAlert && docAlert.message.toLowerCase().includes("hold"),
    "care lead told to consider holding the dose",
  );
  const patientAlert = await prisma.notification.findFirst({
    where: { userId: patient.id, type: "lab_alert" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    !!patientAlert &&
      !patientAlert.message.toLowerCase().includes("hold") &&
      patientAlert.message.toLowerCase().includes("don't change"),
    "patient told doctor was alerted — no dosing instructions",
  );
  const falling = data(
    await call(
      "POST",
      `/care-programs/enrollments/${enrollment.id}/labs`,
      { hb: 6.0 },
      patientToken,
    ),
  );
  assert(
    (falling?.flags ?? []).some((f) => f.key === "hbFalling"),
    "Hb 8.5 → 6.0 (>20% drop) flagged",
  );

  // ── 4. Input validation ───────────────────────────────────
  console.log("\n4) Validation");
  const absurd = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/labs`,
    { hb: 600 },
    patientToken,
  );
  assert(absurd.status === 400, "absurd Hb rejected (400)");
  const empty = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/labs`,
    {},
    patientToken,
  );
  assert(empty.status === 400, "empty panel rejected (400)");

  // ── 5. Due detection ──────────────────────────────────────
  console.log("\n5) Titration due detection");
  await prisma.labResult.updateMany({
    where: { enrollmentId: enrollment.id },
    data: { takenAt: new Date(Date.now() - 60 * DAY) },
  });
  t = data(
    await call(
      "GET",
      `/care-programs/enrollments/${enrollment.id}/titration`,
      null,
      doctorToken,
    ),
  );
  assert(
    (t?.dueReasons ?? []).some((r) => r.includes("monitoring is due")),
    "CBC overdue detected (8-week rule)",
  );
  // Stable 8+ weeks on a dose below MTD with fresh, safe counts → review due.
  await prisma.medicationDose.updateMany({
    where: { enrollmentId: enrollment.id },
    data: { startedAt: new Date(Date.now() - 60 * DAY) },
  });
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/labs`,
    { hb: 8.4, anc: 3.2, platelets: 220 },
    patientToken,
  );
  t = data(
    await call(
      "GET",
      `/care-programs/enrollments/${enrollment.id}/titration`,
      null,
      doctorToken,
    ),
  );
  assert(
    (t?.dueReasons ?? []).some((r) => r.includes("titration step")),
    "stable + safe + below MTD → titration review suggested",
  );
  assert(
    (t?.dueReasons ?? []).every((r) => !r.includes("monitoring is due")),
    "fresh CBC clears the overdue reason",
  );

  // ── 6. Reminder sweep + throttle ──────────────────────────
  console.log("\n6) CBC-due reminders");
  await prisma.labResult.updateMany({
    where: { enrollmentId: enrollment.id },
    data: { takenAt: new Date(Date.now() - 60 * DAY) },
  });
  const sweep1 = data(
    await call("POST", "/admin/care-programs/run-titration", {}, adminToken),
  );
  assert(sweep1?.reminded >= 1, `sweep reminded ${sweep1?.reminded}`);
  let dueNotifs = 0;
  for (let i = 0; i < 10 && dueNotifs === 0; i++) {
    dueNotifs = await prisma.notification.count({
      where: { userId: patient.id, type: "lab_due" },
    });
    if (dueNotifs === 0) await new Promise((r) => setTimeout(r, 300));
  }
  assert(dueNotifs === 1, "patient reminded to get a CBC");
  await call("POST", "/admin/care-programs/run-titration", {}, adminToken);
  const dueNotifs2 = await prisma.notification.count({
    where: { userId: patient.id, type: "lab_due" },
  });
  assert(dueNotifs2 === 1, "14-day throttle suppresses repeat reminders");

  // ── 7. Dose-response history ──────────────────────────────
  console.log("\n7) Dose-response");
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/doses`,
    { doseMgPerDay: 1500, weightKg: 50, note: "titration step" },
    doctorToken,
  );
  t = data(
    await call(
      "GET",
      `/care-programs/enrollments/${enrollment.id}/titration`,
      null,
      patientToken,
    ),
  );
  assert((t?.doseHistory ?? []).length === 2, "dose history has both periods");
  const firstPeriod = (t?.doseHistory ?? []).find(
    (d) => d.doseMgPerDay === 1000,
  );
  assert(
    firstPeriod?.crisesDuring === 1,
    `crisis attributed to the 1000 mg period (${firstPeriod?.crisesDuring})`,
  );
  assert(
    firstPeriod?.avgHbDuring != null,
    `avg Hb computed per period (${firstPeriod?.avgHbDuring})`,
  );
  assert(t?.currentDose?.doseMgPerDay === 1500, "current dose advanced");

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
