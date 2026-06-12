/**
 * Doctor → specialist referral system — end-to-end verification.
 *  - Create referral (auto clinical summary from EMR + SOAP; patient + specialist notified)
 *  - Specialist directory picker (specialty filter, excludes self)
 *  - Specialist accept / decline
 *  - Closed loop: booked appointment links the referral → COMPLETED on consult completion
 *  - Referring-doctor conversion stats + admin funnel + access control
 *
 * Run: node scripts/test-referrals.cjs   (API up on :3001)
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
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

let specialistId, patientId, srcApptId, specApptId, commApptId;
const cleanup = async () => {
  if (commApptId)
    await prisma.appointment.deleteMany({ where: { id: commApptId } });
  if (patientId)
    await prisma.referral.deleteMany({ where: { userId: patientId } });
  if (specApptId)
    await prisma.appointment.deleteMany({ where: { id: specApptId } });
  if (srcApptId)
    await prisma.appointment.deleteMany({ where: { id: srcApptId } });
  if (patientId) {
    await prisma.allergy.deleteMany({
      where: { userId: patientId, substance: { startsWith: "[TEST]" } },
    });
    await prisma.medicalCondition.deleteMany({
      where: { userId: patientId, name: { startsWith: "[TEST]" } },
    });
  }
  await prisma.doctor.deleteMany({
    where: { email: "spec-cardio@test.local" },
  });
};

(async () => {
  const refDoc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const patient = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  if (!refDoc || !patient) throw new Error("Seeds missing.");
  patientId = patient.id;
  await cleanup();

  // A verified specialist to refer to.
  const specialist = await prisma.doctor.create({
    data: {
      name: "Bola Specialist",
      email: "spec-cardio@test.local",
      password: await bcrypt.hash("test1234", 10),
      designation: "Cardiologist",
      verificationStatus: "VERIFIED",
      emailVerified: true,
      phoneVerified: true,
    },
    select: { id: true },
  });
  specialistId = specialist.id;

  // A completed source consult with EMR context + a SOAP note (for the clinical summary).
  const src = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: refDoc.id,
      date: "2026-06-18",
      time: "09:00",
      status: "COMPLETED",
      mode: "SCHEDULED",
      paymentStatus: "PAID",
      isSettled: true,
    },
    select: { id: true },
  });
  srcApptId = src.id;
  await prisma.clinicalNote.create({
    data: {
      appointmentId: src.id,
      doctorId: refDoc.id,
      userId: patient.id,
      assessment: "Suspected arrhythmia",
      plan: "Cardiology review",
    },
  });
  await prisma.allergy.create({
    data: {
      userId: patient.id,
      substance: "[TEST] Sulfa",
      severity: "MODERATE",
    },
  });
  await prisma.medicalCondition.create({
    data: { userId: patient.id, name: "[TEST] Hypertension", status: "ACTIVE" },
  });

  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const refToken = data(dl)?.accessToken;
  const sl = await call("POST", "/auth/doctor/login", {
    email: "spec-cardio@test.local",
    password: "test1234",
  });
  const specToken = data(sl)?.accessToken;
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
    "Logins — refDoc:",
    dl.status,
    "specialist:",
    sl.status,
    "patient:",
    pl.status,
    "admin:",
    al.status,
  );
  if (!refToken || !specToken || !patientToken || !adminToken)
    throw new Error("Login failed.");

  console.log("\n1) Specialist directory picker");
  const dir = await call(
    "GET",
    "/referrals/specialists?specialty=Cardio",
    null,
    refToken,
  );
  assert(
    dir.status === 200 && data(dir).some((d) => d.id === specialistId),
    "specialty filter finds the cardiologist",
  );
  assert(
    !data(dir).some((d) => d.id === refDoc.id),
    "directory excludes the referring doctor (no self-referral)",
  );

  console.log("\n2) Create referral (auto clinical summary + notifications)");
  const beforeNotifs = await prisma.notification.count({
    where: { userId: patient.id },
  });
  const create = await call(
    "POST",
    "/referrals",
    {
      sourceAppointmentId: src.id,
      specialistId,
      reason: "Palpitations, needs ECG",
      diagnosis: "?Arrhythmia",
      urgency: "URGENT",
    },
    refToken,
  );
  const ref = data(create);
  assert(create.status === 201 || create.status === 200, "referral created");
  assert(ref?.status === "PENDING", "status PENDING");
  assert(
    ref?.specialty === "Cardiologist",
    "specialty inherited from specialist designation",
  );
  assert(
    /Sulfa/.test(ref?.clinicalSummary) &&
      /Hypertension/.test(ref?.clinicalSummary) &&
      /arrhythmia/i.test(ref?.clinicalSummary),
    "clinical summary auto-built from EMR + SOAP",
  );
  // Notifications are fire-and-forget — let them settle before asserting.
  await new Promise((r) => setTimeout(r, 800));
  const afterNotifs = await prisma.notification.count({
    where: { userId: patient.id },
  });
  assert(afterNotifs > beforeNotifs, "patient notified of referral");
  const specNotif = await prisma.notification.count({
    where: { doctorId: specialistId, type: "referral_incoming" },
  });
  assert(specNotif >= 1, "specialist notified (incoming inbox)");
  const refId = ref.id;

  const self = await call(
    "POST",
    "/referrals",
    { sourceAppointmentId: src.id, specialistId: refDoc.id },
    refToken,
  );
  assert(self.status === 400, "cannot refer a patient to yourself (400)");

  console.log("\n3) Specialist inbox + accept");
  const inbox = await call("GET", "/referrals/received", null, specToken);
  assert(
    inbox.status === 200 && data(inbox).some((r) => r.id === refId),
    "referral in specialist's received inbox",
  );
  const accept = await call(
    "PATCH",
    `/referrals/${refId}/respond`,
    { accept: true },
    specToken,
  );
  assert(
    data(accept)?.status === "ACCEPTED" && data(accept)?.acceptedAt,
    "specialist accepted (ACCEPTED + acceptedAt)",
  );

  console.log("\n4) Patient sees referral + letter (access control)");
  const mine = await call("GET", "/referrals/mine", null, patientToken);
  assert(
    mine.status === 200 && data(mine).some((r) => r.id === refId),
    "patient sees their referral",
  );
  const letter = await call("GET", `/referrals/${refId}`, null, patientToken);
  assert(
    letter.status === 200 && data(letter)?.clinicalSummary,
    "patient can read the referral letter",
  );
  const stranger = await call("GET", `/referrals/${refId}`, null, specToken); // specialist is a party → allowed
  assert(stranger.status === 200, "specialist (a party) can read the letter");

  console.log(
    "\n5) Closed loop — booked specialist consult completes the referral",
  );
  // Fixture: the patient's booking with the specialist (carries the referralId).
  const specAppt = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: specialistId,
      referralId: refId,
      date: "2026-06-25",
      time: "11:00",
      status: "CONFIRMED",
      mode: "SCHEDULED",
      paymentStatus: "PAID",
      isSettled: true,
    },
    select: { id: true },
  });
  specApptId = specAppt.id;
  await prisma.referral.update({
    where: { id: refId },
    data: { status: "BOOKED", bookedAppointmentId: specAppt.id },
  });
  const done = await call(
    "PATCH",
    `/appointments/${specAppt.id}/status`,
    { status: "COMPLETED" },
    specToken,
  );
  assert(done.status === 200, "specialist completes the consult");
  const refAfter = await prisma.referral.findUnique({
    where: { id: refId },
    select: { status: true },
  });
  assert(
    refAfter?.status === "COMPLETED",
    "referral auto-advanced BOOKED → COMPLETED",
  );

  console.log("\n6) Conversion stats + decline + admin funnel");
  const stats = await call("GET", "/referrals/sent/stats", null, refToken);
  assert(
    data(stats)?.total >= 1 && data(stats)?.completed >= 1,
    "referring doctor sees conversion stats",
  );
  // A second referral the specialist declines.
  const create2 = await call(
    "POST",
    "/referrals",
    { sourceAppointmentId: src.id, specialistId, reason: "Second opinion" },
    refToken,
  );
  const decline = await call(
    "PATCH",
    `/referrals/${data(create2).id}/respond`,
    { accept: false, reason: "Outside my subspecialty" },
    specToken,
  );
  assert(
    data(decline)?.status === "DECLINED" &&
      /subspecialty/.test(data(decline)?.declineReason),
    "specialist can decline with a reason",
  );
  const funnel = await call("GET", "/admin/referrals/funnel", null, adminToken);
  assert(
    funnel.status === 200 && typeof data(funnel)?.conversionRate === "number",
    "admin funnel returns conversion rate",
  );
  const adminList = await call("GET", "/admin/referrals", null, adminToken);
  assert(
    adminList.status === 200 && data(adminList).items.length >= 1,
    "admin referral list",
  );

  console.log(
    "\n7) Referral commission — specialist-funded split at settlement",
  );
  // A fresh referral the specialist accepts WITH a 10% commission offer.
  const c = data(
    await call(
      "POST",
      "/referrals",
      { sourceAppointmentId: src.id, specialistId, reason: "Commission case" },
      refToken,
    ),
  );
  const setPct = await call(
    "PATCH",
    `/referrals/${c.id}/commission`,
    { pct: 10 },
    specToken,
  );
  assert(
    data(setPct)?.commissionPct === 10,
    "specialist sets a 10% commission",
  );
  const tooHigh = await call(
    "PATCH",
    `/referrals/${c.id}/commission`,
    { pct: 90 },
    specToken,
  );
  assert(data(tooHigh)?.commissionPct === 50, "commission is capped at 50%");
  await call("PATCH", `/referrals/${c.id}/commission`, { pct: 10 }, specToken); // back to 10
  const otherDocPatch = await call(
    "PATCH",
    `/referrals/${c.id}/commission`,
    { pct: 25 },
    refToken,
  );
  assert(
    otherDocPatch.status === 403,
    "only the specialist can set the commission",
  );

  // The booked specialist consult, unsettled, with a known earning.
  const balBefore = async (id) =>
    (await prisma.doctorWallet.findUnique({ where: { doctorId: id } }))
      ?.balance ?? 0;
  const refBalBefore = await balBefore(refDoc.id);
  const specBalBefore = await balBefore(specialistId);
  const comm = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: specialistId,
      referralId: c.id,
      date: "2026-07-01",
      time: "10:00",
      status: "CONFIRMED",
      mode: "SCHEDULED",
      paymentStatus: "PAID",
      isSettled: false,
      doctorEarning: 800000, // ₦8,000 in kobo
      amount: 1000000, // ₦10,000 in kobo
    },
    select: { id: true },
  });
  commApptId = comm.id;
  await prisma.referral.update({
    where: { id: c.id },
    data: { status: "BOOKED", bookedAppointmentId: comm.id },
  });
  await call(
    "PATCH",
    `/appointments/${comm.id}/status`,
    { status: "COMPLETED" },
    specToken,
  );

  const refDelta = (await balBefore(refDoc.id)) - refBalBefore;
  const specDelta = (await balBefore(specialistId)) - specBalBefore;
  assert(
    refDelta === 80000,
    `referring doctor credited exactly 10% (₦800 = 80000 kobo), got ${refDelta}`,
  );
  assert(
    specDelta === 720000,
    `specialist credited the remainder (₦7200 = 720000 kobo), got ${specDelta}`,
  );
  const cAfter = await prisma.referral.findUnique({
    where: { id: c.id },
    select: { commissionAmount: true, commissionPaidAt: true, status: true },
  });
  assert(
    cAfter?.commissionAmount === 80000 && cAfter?.commissionPaidAt,
    "referral records commissionAmount + commissionPaidAt",
  );
  assert(cAfter?.status === "COMPLETED", "referral COMPLETED");
  const ledger = await prisma.doctorWalletHistory.findFirst({
    where: {
      wallet: { doctorId: refDoc.id },
      type: "REFERRAL_COMMISSION",
      amount: 80000,
    },
  });
  assert(
    ledger != null,
    "REFERRAL_COMMISSION ledger entry written for the referrer",
  );
  // Idempotent: completing again must not double-pay.
  await call(
    "PATCH",
    `/appointments/${comm.id}/status`,
    { status: "COMPLETED" },
    specToken,
  );
  const refDelta2 = (await balBefore(refDoc.id)) - refBalBefore;
  assert(refDelta2 === 80000, "no double commission on a repeat completion");

  console.log("\n8) Expiry + PDF letter");
  const stale = await prisma.referral.create({
    data: {
      referringDoctorId: refDoc.id,
      specialistId,
      userId: patient.id,
      specialty: "Cardiology",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 86400000),
    },
    select: { id: true },
  });
  await call("POST", "/admin/run-referral-expiry", {}, adminToken);
  const staleAfter = await prisma.referral.findUnique({
    where: { id: stale.id },
    select: { status: true },
  });
  assert(
    staleAfter?.status === "EXPIRED",
    "overdue PENDING referral auto-expired",
  );
  const pdfRes = await fetch(`${BASE}/referrals/${c.id}/pdf`, {
    headers: { authorization: `Bearer ${patientToken}` },
  });
  assert(
    pdfRes.status === 200 &&
      (pdfRes.headers.get("content-type") || "").includes("application/pdf"),
    "referral letter PDF streams (200, application/pdf)",
  );

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("ERROR:", e.message);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
