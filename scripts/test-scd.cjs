/**
 * SCD Phase 3 verification — genotype-stratified protocols, crisis diary,
 * and the baseline learner (per-patient threshold suggestions).
 *
 * The core claim under test: PERSONALIZATION CHANGES THE DECISION. The same
 * reading that is fine on the population default must alert under the
 * patient's genotype protocol, and the learner must adapt warning bands to
 * the patient's own steady state without ever touching critical bounds.
 *
 * Run: node --env-file=.env scripts/test-scd.cjs   (API up on :3001, care programs seeded)
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

const cleanup = async () => {
  if (!patientId) return;
  const enr = await prisma.programEnrollment.findMany({
    where: { userId: patientId, program: { code: "sickle_cell" } },
    select: { id: true },
  });
  const ids = enr.map((e) => e.id);
  if (ids.length) {
    await prisma.crisisEvent.deleteMany({
      where: { enrollmentId: { in: ids } },
    });
    await prisma.vitalAlert.deleteMany({
      where: { enrollmentId: { in: ids } },
    });
    await prisma.vitalReading.deleteMany({
      where: { enrollmentId: { in: ids } },
    });
    await prisma.programEnrollment.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.notification.deleteMany({
    where: { type: "crisis_logged" },
  });
  // Restore the test patient's original genotype
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
  console.log("Logins — doctor:", dl.status, "patient:", pl.status);
  if (!doctorToken || !patientToken) throw new Error("Login failed");

  const program = await prisma.careProgram.findUnique({
    where: { code: "sickle_cell" },
    select: { id: true, genotypeConfig: true },
  });
  if (!program) throw new Error("sickle_cell program not seeded");

  // ── 1. Genotype-aware enrollment ──────────────────────────
  console.log("\n1) Genotype-aware enrollment");
  const enrolled = await call(
    "POST",
    `/care-programs/${program.id}/enroll`,
    { genotype: "ss", doctorId: doc.id },
    patientToken,
  );
  const enrollment = data(enrolled);
  assert(
    enrolled.status === 200 || enrolled.status === 201,
    `enrolled (${enrolled.status})`,
  );
  assert(enrollment?.genotype === "SS", "genotype normalized + snapshotted");
  const profileAfter = await prisma.healthProfile.findFirst({
    where: { userId: patient.id, subPatientId: null },
    select: { genotype: true },
  });
  assert(
    profileAfter?.genotype === "SS",
    "health profile backfilled with genotype",
  );

  // ── 2. Genotype protocol layer ────────────────────────────
  console.log("\n2) Genotype protocol layer (SS)");
  const det1 = await call(
    "GET",
    `/care-programs/enrollments/${enrollment.id}`,
    null,
    patientToken,
  );
  const d1 = data(det1);
  const painCfg = (d1?.vitals ?? []).find((v) => v.type === "PAIN");
  const hydCfg = (d1?.vitals ?? []).find((v) => v.type === "HYDRATION");
  const spo2Cfg = (d1?.vitals ?? []).find((v) => v.type === "SPO2");
  assert(
    painCfg?.max === 4 && painCfg?.criticalMax === 7,
    `PAIN band tightened for SS (max ${painCfg?.max}, crit ${painCfg?.criticalMax})`,
  );
  assert(hydCfg?.min === 8, `HYDRATION min raised for SS (${hydCfg?.min})`);
  assert(spo2Cfg?.min === 93, `SPO2 min raised for SS (${spo2Cfg?.min})`);

  // The decisive test: PAIN 5 is OK on the base protocol (max 5) but must
  // WARN under the SS protocol (max 4) — personalization changes the decision.
  const painRead = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/readings`,
    { type: "PAIN", value: 5 },
    patientToken,
  );
  assert(
    data(painRead)?.status === "WARNING",
    "PAIN 5/10 → WARNING under SS (would be OK on base protocol)",
  );
  // Same for hydration: 7 cups is fine on base (min 6) but short for SS (min 8).
  const hydRead = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/readings`,
    { type: "HYDRATION", value: 7 },
    patientToken,
  );
  assert(
    data(hydRead)?.status === "WARNING",
    "HYDRATION 7 cups → WARNING under SS (would be OK on base)",
  );

  // ── 3. Crisis diary ───────────────────────────────────────
  console.log("\n3) Crisis diary");
  const crisis = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/crises`,
    {
      painScore: 8,
      sites: ["Chest", "Joints"],
      triggers: ["Dehydration", "Stress"],
      hospitalized: false,
    },
    patientToken,
  );
  const cd = data(crisis);
  assert(
    crisis.status === 200 || crisis.status === 201,
    `crisis logged (${crisis.status})`,
  );
  assert(cd?.severity === "CRITICAL", "pain 8/10 → CRITICAL severity");
  assert(!cd?.crisis?.resolvedAt, "crisis is ongoing (no resolvedAt)");

  const painReading = await prisma.vitalReading.findFirst({
    where: { enrollmentId: enrollment.id, note: "Crisis episode" },
  });
  assert(
    painReading?.value === 8,
    "crisis also wrote a PAIN reading (feeds charts/learner)",
  );
  const crisisAlert = await prisma.vitalAlert.findFirst({
    where: { enrollmentId: enrollment.id, severity: "CRITICAL" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    (crisisAlert?.message ?? "").includes("crisis logged"),
    "care-lead alert created without cooldown",
  );
  // notify calls are fire-and-forget — poll briefly instead of racing them.
  let docNotif = null;
  let patientNotif = null;
  for (let i = 0; i < 10 && (!docNotif || !patientNotif); i++) {
    [docNotif, patientNotif] = await Promise.all([
      prisma.notification.findFirst({
        where: { doctorId: doc.id, type: "crisis_logged" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.findFirst({
        where: { userId: patient.id, type: "crisis_logged" },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    if (!docNotif || !patientNotif)
      await new Promise((r) => setTimeout(r, 300));
  }
  assert(!!docNotif, "care lead notified");
  assert(!!patientNotif, "patient gets safety guidance on CRITICAL crisis");

  const badPain = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/crises`,
    { painScore: 11 },
    patientToken,
  );
  assert(badPain.status === 400, "painScore 11 rejected (400)");
  const asDoctor = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/crises`,
    { painScore: 5 },
    doctorToken,
  );
  assert(asDoctor.status === 403, "doctor role cannot log patient crises");

  const resolved = await call(
    "POST",
    `/care-programs/crises/${cd.crisis.id}/resolve`,
    { treatment: "IV fluids and analgesia" },
    patientToken,
  );
  assert(!!data(resolved)?.resolvedAt, "crisis marked resolved");

  const det2 = await call(
    "GET",
    `/care-programs/enrollments/${enrollment.id}`,
    null,
    doctorToken,
  );
  const d2 = data(det2);
  assert((d2?.crises ?? []).length === 1, "detail returns crisis history");
  assert(
    d2?.crisisStats?.count90d === 1 &&
      (d2?.crisisStats?.topTriggers ?? []).some(
        (t) => t.trigger === "Dehydration",
      ),
    "crisis stats computed (count + top triggers)",
  );

  // ── 4. Baseline learner ───────────────────────────────────
  console.log("\n4) Baseline learner");
  // Steady-state SpO2 around 90-91 — normal for THIS patient, but below the
  // SS protocol min of 93, so the default band would alert constantly.
  const values = [90, 90, 91, 91, 91, 90, 92, 91, 90, 91];
  for (let i = 0; i < values.length; i++) {
    await prisma.vitalReading.create({
      data: {
        userId: patient.id,
        enrollmentId: enrollment.id,
        type: "SPO2",
        value: values[i],
        takenAt: new Date(Date.now() - (values.length - i) * 86_400_000),
      },
    });
  }
  const det3 = await call(
    "GET",
    `/care-programs/enrollments/${enrollment.id}`,
    null,
    doctorToken,
  );
  const sug = data(det3)?.suggestedThresholds?.SPO2;
  assert(!!sug, "SPO2 suggestion produced from patient's own readings");
  assert(
    sug?.min === 90,
    `suggested min = patient's p10 clamped above critical (got ${sug?.min})`,
  );
  assert(
    sug?.min >
      (data(det3)?.vitals ?? []).find((v) => v.type === "SPO2")?.criticalMin,
    "suggestion never crosses the critical safety rail",
  );
  assert(
    typeof sug?.rationale === "string" && sug.rationale.includes("readings"),
    "suggestion is explainable (rationale text)",
  );

  // Care lead applies it through the normal thresholds endpoint
  const applied = await call(
    "PATCH",
    `/care-programs/enrollments/${enrollment.id}/thresholds`,
    { thresholds: { SPO2: { min: sug.min } } },
    doctorToken,
  );
  assert(
    applied.status === 200 || applied.status === 201,
    "care lead applied the suggestion",
  );
  const det4 = await call(
    "GET",
    `/care-programs/enrollments/${enrollment.id}`,
    null,
    doctorToken,
  );
  const spo2After = (data(det4)?.vitals ?? []).find((v) => v.type === "SPO2");
  assert(
    spo2After?.min === sug.min,
    "per-patient override now the effective band",
  );
  assert(
    !data(det4)?.suggestedThresholds?.SPO2,
    "suggestion disappears once the band fits the patient",
  );
  // And the decision flips: SpO2 91 was a WARNING under min 93, now OK.
  const spo2Read = await call(
    "POST",
    `/care-programs/enrollments/${enrollment.id}/readings`,
    { type: "SPO2", value: 91 },
    patientToken,
  );
  assert(
    data(spo2Read)?.status === "OK",
    "SpO2 91% now OK for this patient (was WARNING before tuning)",
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
