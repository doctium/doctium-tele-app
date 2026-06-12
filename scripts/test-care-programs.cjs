// Live verification of Chronic Disease Management Phase 1:
//  - catalog + enrollment (care lead assignment, duplicate block)
//  - vital logging: validation, baseline capture, threshold evaluation
//  - alert engine: WARNING/CRITICAL tiers, 12h cooldown, CRITICAL escalation bypass
//  - per-patient threshold overrides, doctor cohort RAG, alert inbox + ack
//  - admin catalog CRUD + overview, role/permission gates
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

let enrollmentId = null;
let tmpProgramId = null;

const cleanup = async () => {
  if (enrollmentId) {
    await prisma.vitalAlert.deleteMany({ where: { enrollmentId } });
    await prisma.vitalReading.deleteMany({ where: { enrollmentId } });
    await prisma.programEnrollment.deleteMany({ where: { id: enrollmentId } });
  }
  if (tmpProgramId)
    await prisma.careProgram.deleteMany({ where: { id: tmpProgramId } });
};

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, name: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true, name: true },
  });
  const program = await prisma.careProgram.findUnique({
    where: { code: "hypertension" },
  });
  if (!usr || !doc) throw new Error("seed patient/doctor missing");
  if (!program) throw new Error("run scripts/seed-care-programs.cjs first");
  // clean slate from any earlier failed run
  const old = await prisma.programEnrollment.findMany({
    where: { userId: usr.id, programId: program.id },
    select: { id: true },
  });
  for (const e of old) {
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

  // ── 1) catalog ──
  console.log("\n1) Catalog");
  assert(
    (await call("GET", "/care-programs")).status === 401,
    "no token → 401",
  );
  const cat = await call("GET", "/care-programs", null, pTok);
  const catB = data(cat);
  assert(cat.status === 200, "patient catalog → 200");
  assert(
    (catB.programs ?? []).length >= 5,
    `≥5 programs seeded (${catB.programs?.length})`,
  );
  assert(
    !!catB.vitalCatalog?.BLOOD_PRESSURE?.unit,
    "vital catalog (labels/units) shipped",
  );

  // ── 2) enrollment ──
  console.log("\n2) Enrollment");
  const en = await call(
    "POST",
    `/care-programs/${program.id}/enroll`,
    { doctorId: doc.id },
    pTok,
  );
  const enB = data(en);
  enrollmentId = enB?.id;
  assert(en.status < 300 && !!enrollmentId, `enrolled (${en.status})`);
  assert(enB.doctorId === doc.id, "care lead assigned");
  const dup = await call(
    "POST",
    `/care-programs/${program.id}/enroll`,
    {},
    pTok,
  );
  assert(dup.status === 400, "duplicate enrollment blocked → 400");
  const enrollNotif = await prisma.notification.findFirst({
    where: { doctorId: doc.id, type: "care_program_enrollment" },
    orderBy: { createdAt: "desc" },
  });
  assert(!!enrollNotif, "care lead notified of new patient");

  const log = (body) =>
    call(
      "POST",
      `/care-programs/enrollments/${enrollmentId}/readings`,
      body,
      pTok,
    );

  // ── 3) reading validation ──
  console.log("\n3) Reading validation");
  assert(
    (await log({ type: "NOT_A_VITAL", value: 1 })).status === 400,
    "unknown vital type → 400",
  );
  assert(
    (await log({ type: "BLOOD_GLUCOSE", value: 120 })).status === 400,
    "vital not tracked by program → 400",
  );
  assert(
    (await log({ type: "BLOOD_PRESSURE", value: 120 })).status === 400,
    "BP without diastolic → 400",
  );
  assert(
    (await log({ type: "BLOOD_PRESSURE", value: 999, value2: 80 })).status ===
      400,
    "absurd value rejected → 400",
  );

  // ── 4) alert engine ──
  console.log("\n4) Alert engine");
  const okR = await log({ type: "BLOOD_PRESSURE", value: 120, value2: 80 });
  assert(
    data(okR)?.status === "OK" && data(okR)?.alertCreated === false,
    "in-range reading → OK, no alert",
  );

  const warnR = await log({ type: "BLOOD_PRESSURE", value: 155, value2: 95 });
  assert(
    data(warnR)?.status === "WARNING" && data(warnR)?.alertCreated === true,
    "out-of-target reading → WARNING alert created",
  );
  const docNotif = await prisma.notification.findFirst({
    where: { doctorId: doc.id, type: "vital_alert" },
    orderBy: { createdAt: "desc" },
  });
  assert(!!docNotif, "care lead notified of the alert");

  const warn2 = await log({ type: "BLOOD_PRESSURE", value: 158, value2: 96 });
  assert(
    data(warn2)?.status === "WARNING" && data(warn2)?.alertCreated === false,
    "repeat warning within 12h suppressed (cooldown)",
  );

  const critR = await log({ type: "BLOOD_PRESSURE", value: 190, value2: 125 });
  assert(
    data(critR)?.status === "CRITICAL" && data(critR)?.alertCreated === true,
    "CRITICAL escalation breaks through warning cooldown",
  );
  const crit2 = await log({ type: "BLOOD_PRESSURE", value: 192, value2: 126 });
  assert(
    data(crit2)?.alertCreated === false,
    "repeat critical within 12h suppressed",
  );
  const patientNotif = await prisma.notification.findFirst({
    where: { userId: usr.id, type: "vital_alert" },
  });
  assert(!!patientNotif, "patient urged to book a consult on CRITICAL");

  const enrollRow = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
  });
  assert(
    enrollRow?.baseline?.BLOOD_PRESSURE?.value === 120,
    "first reading captured as outcome baseline",
  );
  const alertCount = await prisma.vitalAlert.count({ where: { enrollmentId } });
  assert(
    alertCount === 2,
    `exactly 2 alerts exist (1 warning + 1 critical), got ${alertCount}`,
  );

  // ── 5) patient views ──
  console.log("\n5) Patient views");
  const mine = await call("GET", "/care-programs/mine", null, pTok);
  const mineE = (data(mine)?.enrollments ?? []).find(
    (e) => e.id === enrollmentId,
  );
  assert(!!mineE, "enrollment in 'mine'");
  assert(
    mineE?.latestByType?.BLOOD_PRESSURE?.value === 192 &&
      mineE?.openAlerts === 2,
    "latest reading + open alert count surface on the hub",
  );
  const detail = await call(
    "GET",
    `/care-programs/enrollments/${enrollmentId}`,
    null,
    pTok,
  );
  const detB = data(detail);
  assert(
    (detB?.readingsByType?.BLOOD_PRESSURE ?? []).length === 5,
    "detail: full BP series returned",
  );
  assert(
    (detB?.vitals ?? []).some(
      (v) => v.type === "BLOOD_PRESSURE" && v.max === 140,
    ),
    "detail: resolved thresholds included",
  );
  assert(
    (
      await call(
        "GET",
        `/care-programs/enrollments/${enrollmentId}`,
        null,
        dTok,
      )
    ).status === 200,
    "care lead can view the enrollment",
  );

  // ── 6) doctor cohort + alert inbox ──
  console.log("\n6) Doctor cohort & alerts");
  const cohort = await call("GET", "/care-programs/doctor/cohort", null, dTok);
  const member = (data(cohort)?.cohort ?? []).find(
    (c) => c.id === enrollmentId,
  );
  assert(!!member, "patient appears in the doctor's cohort");
  assert(member?.rag === "RED", `open critical → RED status (${member?.rag})`);
  assert(
    member?.openAlerts === 2 && member?.readings7d === 5,
    "cohort row carries alert + adherence counts",
  );

  const inbox = await call("GET", "/care-programs/doctor/alerts", null, dTok);
  const inboxRows = data(inbox) ?? [];
  assert(
    inboxRows.length === 2,
    `alert inbox shows 2 open (${inboxRows.length})`,
  );
  const critAlert = inboxRows.find((a) => a.severity === "CRITICAL");
  assert(
    (await call("POST", `/care-programs/alerts/${critAlert?.id}/ack`, {}, pTok))
      .status === 403,
    "patient cannot acknowledge alerts → 403",
  );
  const ack = await call(
    "POST",
    `/care-programs/alerts/${critAlert?.id}/ack`,
    {},
    dTok,
  );
  assert(
    ack.status < 300 && !!data(ack)?.acknowledgedAt,
    "doctor acknowledges the critical alert",
  );
  const inbox2 = await call("GET", "/care-programs/doctor/alerts", null, dTok);
  assert((data(inbox2) ?? []).length === 1, "inbox drops to 1 open alert");

  // ── 7) per-patient threshold overrides ──
  console.log("\n7) Threshold overrides");
  const patch = await call(
    "PATCH",
    `/care-programs/enrollments/${enrollmentId}/thresholds`,
    {
      thresholds: {
        BLOOD_PRESSURE: { max: 130, bogus: 999 },
        JUNK_TYPE: { max: 1 },
      },
    },
    dTok,
  );
  const patched = data(patch);
  assert(patch.status === 200, "care lead sets per-patient thresholds");
  assert(
    patched?.thresholds?.BLOOD_PRESSURE?.max === 130 &&
      !patched?.thresholds?.BLOOD_PRESSURE?.bogus &&
      !patched?.thresholds?.JUNK_TYPE,
    "unknown types/keys sanitized out",
  );
  const overrideR = await log({
    type: "BLOOD_PRESSURE",
    value: 135,
    value2: 80,
  });
  assert(
    data(overrideR)?.status === "WARNING",
    "135 systolic now WARNING under the tightened 130 target (default was 140)",
  );
  assert(
    (
      await call(
        "PATCH",
        `/care-programs/enrollments/${enrollmentId}/thresholds`,
        { thresholds: {} },
        pTok,
      )
    ).status === 403,
    "patient cannot edit thresholds → 403",
  );

  // ── 8) withdraw ──
  console.log("\n8) Withdraw");
  const wd = await call(
    "POST",
    `/care-programs/enrollments/${enrollmentId}/withdraw`,
    {},
    pTok,
  );
  assert(data(wd)?.status === "WITHDRAWN", "withdrawal flips status");
  const cohort2 = await call("GET", "/care-programs/doctor/cohort", null, dTok);
  assert(
    !(data(cohort2)?.cohort ?? []).some((c) => c.id === enrollmentId),
    "withdrawn patient leaves the cohort",
  );
  assert(
    (await log({ type: "BLOOD_PRESSURE", value: 120, value2: 80 })).status ===
      400,
    "logging blocked after withdrawal → 400",
  );

  // ── 9) admin ──
  console.log("\n9) Admin");
  assert(
    (await call("GET", "/admin/care-programs/overview", null, dTok)).status ===
      403,
    "doctor blocked from admin care-programs → 403",
  );
  const list = await call("GET", "/admin/care-programs", null, aTok);
  assert(
    (data(list) ?? []).some(
      (p) =>
        p.code === "hypertension" && typeof p.totalEnrollments === "number",
    ),
    "admin list carries enrollment counts",
  );
  const ov = await call("GET", "/admin/care-programs/overview", null, aTok);
  const ovB = data(ov);
  assert(ov.status === 200, "admin overview → 200");
  assert(
    typeof ovB.activeEnrollments === "number" &&
      typeof ovB.readings30d === "number" &&
      typeof ovB.alerts30d?.critical === "number" &&
      Array.isArray(ovB.outcomes),
    "overview: enrollments, readings, alert volumes + outcome deltas",
  );
  const created = await call(
    "POST",
    "/admin/care-programs",
    {
      code: "test_tmp_prog",
      name: "Temp Program",
      vitals: [{ type: "WEIGHT", cadencePerWeek: 1 }],
      isActive: false,
    },
    aTok,
  );
  tmpProgramId = data(created)?.id;
  assert(created.status < 300 && !!tmpProgramId, "admin creates a program");
  const upd = await call(
    "PATCH",
    `/admin/care-programs/${tmpProgramId}`,
    { name: "Temp v2", price: 500000 },
    aTok,
  );
  assert(
    data(upd)?.name === "Temp v2" && data(upd)?.price === 500000,
    "admin edits a program",
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
