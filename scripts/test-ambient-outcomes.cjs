/**
 * Phase 6 verification — ambient scribe gating (consent → asset → fetch chain
 * for source: "recording") and the SCD investor outcomes endpoint + anonymized
 * CSV. The happy-path Whisper transcription reuses the pipeline already
 * verified by test-scribe.cjs; what needs proof here is that NO recording is
 * ever transcribed without both-party consent and an available asset.
 *
 * Run: node --env-file=.env scripts/test-ambient-outcomes.cjs
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
const callText = async (path, token) => {
  const r = await fetch(`${BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: r.status, text: await r.text() };
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
  if (apptIds.length) {
    // consent/session/assets/access logs cascade with the appointment
    await prisma.clinicalNote.deleteMany({
      where: { appointmentId: { in: apptIds } },
    });
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  }
  if (patientId) {
    const enr = await prisma.programEnrollment.findMany({
      where: { userId: patientId, program: { code: "sickle_cell" } },
      select: { id: true },
    });
    const ids = enr.map((e) => e.id);
    if (ids.length) {
      await prisma.vitalReading.deleteMany({
        where: { enrollmentId: { in: ids } },
      });
      await prisma.programEnrollment.deleteMany({
        where: { id: { in: ids } },
      });
    }
    await prisma.notification.deleteMany({
      where: {
        type: {
          in: ["care_risk", "crisis_logged", "care_dose", "lab_alert"],
        },
      },
    });
    if (originalGenotype !== null) {
      await prisma.healthProfile.updateMany({
        where: { userId: patientId, subPatientId: null },
        data: { genotype: originalGenotype },
      });
    }
  }
};

(async () => {
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const patient = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, name: true },
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

  const appt = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doc.id,
      date: "2026-06-11",
      time: "15:00",
      status: "COMPLETED",
    },
    select: { id: true },
  });
  apptIds.push(appt.id);

  // ── 1. Ambient scribe consent chain ───────────────────────
  console.log("\n1) Ambient scribe gating");
  const noConsent = await call(
    "POST",
    `/emr/notes/${appt.id}/draft`,
    { source: "recording" },
    doctorToken,
  );
  assert(
    noConsent.status === 400 &&
      (noConsent.body.message ?? "").toLowerCase().includes("consent"),
    "no consent row → 400 naming consent",
  );

  const consent = await prisma.appointmentRecordingConsent.create({
    data: {
      appointmentId: appt.id,
      status: "PENDING",
      requestedByRole: "DOCTOR",
      requestedById: doc.id,
    },
  });
  const pending = await call(
    "POST",
    `/emr/notes/${appt.id}/draft`,
    { source: "recording" },
    doctorToken,
  );
  assert(pending.status === 400, "PENDING consent → still blocked");

  await prisma.appointmentRecordingConsent.update({
    where: { id: consent.id },
    data: {
      status: "CONSENTED",
      patientConsentedAt: new Date(),
      doctorConsentedAt: new Date(),
    },
  });
  const noAsset = await call(
    "POST",
    `/emr/notes/${appt.id}/draft`,
    { source: "recording" },
    doctorToken,
  );
  assert(
    noAsset.status === 400 &&
      (noAsset.body.message ?? "").includes("No recording"),
    "consented but no asset → 400",
  );

  const bigAsset = await prisma.appointmentRecordingAsset.create({
    data: {
      appointmentId: appt.id,
      objectKey: `test/${appt.id}/big.mp4`,
      providerUrl: "http://localhost:9/never.mp4",
      sizeBytes: BigInt(50 * 1024 * 1024),
      status: "AVAILABLE",
    },
  });
  const tooBig = await call(
    "POST",
    `/emr/notes/${appt.id}/draft`,
    { source: "recording" },
    doctorToken,
  );
  assert(
    tooBig.status === 400 && (tooBig.body.message ?? "").includes("too large"),
    "oversized asset → 400 (Whisper ceiling)",
  );

  await prisma.appointmentRecordingAsset.update({
    where: { id: bigAsset.id },
    data: { sizeBytes: BigInt(2_000_000) },
  });
  const unreachable = await call(
    "POST",
    `/emr/notes/${appt.id}/draft`,
    { source: "recording" },
    doctorToken,
  );
  assert(
    unreachable.status === 400 &&
      (unreachable.body.message ?? "").includes("fetch"),
    "unreachable storage → clean 400, not a crash",
  );
  const accessLogs = await prisma.appointmentRecordingAccessLog.count({
    where: { appointmentId: appt.id, action: "AI_SCRIBE_TRANSCRIBE" },
  });
  assert(
    accessLogs === 0,
    "no AI access logged when the recording was never read",
  );
  const note = await prisma.clinicalNote.findUnique({
    where: { appointmentId: appt.id },
  });
  assert(!note?.aiDrafted, "no provenance written on failed attempts");

  // ── 2. SCD outcomes fixtures ──────────────────────────────
  console.log("\n2) SCD outcomes");
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
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/crises`,
    { painScore: 8, triggers: ["Dehydration"], hospitalized: true },
    patientToken,
  );
  await call("POST", "/admin/care-programs/run-risk", {}, adminToken);
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/doses`,
    { doseMgPerDay: 1000, weightKg: 50 },
    doctorToken,
  );
  await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/labs`,
    { hb: 8.5, anc: 3.2, platelets: 240 },
    patientToken,
  );

  const ov = data(
    await call("GET", "/admin/care-programs/scd-outcomes", null, adminToken),
  );
  assert(ov?.activePatients >= 1, `active patients (${ov?.activePatients})`);
  assert((ov?.byGenotype?.SS ?? 0) >= 1, "genotype mix includes SS");
  assert(
    ov?.crisisStats?.count90d >= 1 && ov?.crisisStats?.hospitalizations90d >= 1,
    "crisis burden counted (incl. hospitalization)",
  );
  assert(
    ov?.crisisStats?.topTriggers?.some((t) => t.trigger === "Dehydration"),
    "top triggers surfaced",
  );
  const distTotal = Object.values(ov?.riskDistribution ?? {}).reduce(
    (s, n) => s + n,
    0,
  );
  assert(distTotal >= 1, "live risk distribution populated");
  assert(
    ov?.titration?.onHydroxyurea >= 1 &&
      ov?.titration?.cbcCompliancePercent === 100,
    `hydroxyurea coverage + CBC compliance (${ov?.titration?.cbcCompliancePercent}%)`,
  );
  assert(
    typeof ov?.aiScribe?.totalDraftedNotes === "number",
    "AI scribe leverage included",
  );

  const asDoctor = await call(
    "GET",
    "/admin/care-programs/scd-outcomes",
    null,
    doctorToken,
  );
  assert(asDoctor.status === 403, "doctor role blocked from admin outcomes");

  // ── 3. Anonymized investor CSV ────────────────────────────
  console.log("\n3) Investor CSV");
  const csv = await callText(
    "/admin/care-programs/scd-outcomes.csv",
    adminToken,
  );
  assert(csv.status === 200, "CSV downloads (200)");
  assert(
    csv.text.startsWith("patientRef,genotype,status"),
    "CSV header present",
  );
  assert(csv.text.includes(",SS,ACTIVE,"), "enrollment row present");
  assert(
    !csv.text.includes("08000000002") && !csv.text.includes(patient.name),
    "CSV is anonymized — no names or contacts",
  );

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
