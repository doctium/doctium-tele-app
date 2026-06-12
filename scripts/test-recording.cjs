/**
 * Recording lifecycle integration test — the safety net for extracting the
 * recording subsystem out of the appointments service. Drives the API end-to-end
 * and asserts the compliance-critical behaviors that the refactor MUST preserve:
 * consent state machine, participant gating, role guards, asset register/list,
 * playback entitlement, and export/delete requests.
 *
 * Deliberately env-independent: it never starts a real Zego/S3 recording, so it
 * runs anywhere the API + DB are up. Run: node scripts/test-recording.cjs
 * (API up on :3001, seeded with rxdoc + patient 08000000002).
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const BASE = process.env.API_BASE || "http://localhost:3001/api/v1";
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}
const ok = (s) => s === 200 || s === 201;

async function call(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, data: json?.data };
}

async function login(path, creds) {
  const r = await call("POST", path, creds);
  const token = r.data?.accessToken || r.data?.token;
  if (!token)
    throw new Error(`login failed for ${path}: ${JSON.stringify(r.body)}`);
  return token;
}

const created = { appts: [], outsiderUserId: null };

async function cleanupAppointment(id) {
  await prisma.appointmentRecordingAccessLog.deleteMany({
    where: { appointmentId: id },
  });
  await prisma.appointmentRecordingAsset.deleteMany({
    where: { appointmentId: id },
  });
  await prisma.appointmentRecordingRequest.deleteMany({
    where: { appointmentId: id },
  });
  await prisma.appointmentRecordingSession.deleteMany({
    where: { appointmentId: id },
  });
  await prisma.appointmentRecordingConsent.deleteMany({
    where: { appointmentId: id },
  });
  await prisma.appointment.deleteMany({ where: { id } });
}

async function cleanup() {
  for (const id of created.appts) await cleanupAppointment(id).catch(() => {});
  if (created.outsiderUserId) {
    await prisma.userWallet
      .deleteMany({ where: { userId: created.outsiderUserId } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: created.outsiderUserId } })
      .catch(() => {});
  }
}

async function main() {
  // ── Setup ────────────────────────────────────────────────
  const doctor = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
  });
  const patient = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
  });
  if (!doctor || !patient)
    throw new Error("Seed data missing — run seed-rx-test.cjs + seed-kyc.cjs");

  // Outsider patient (non-participant) for the access-control negatives.
  const hash = await bcrypt.hash("test1234", 10);
  const outsider = await prisma.user.create({
    data: {
      mobile: "08000009999",
      password: hash,
      name: "Rec Outsider",
      loginType: "MOBILE",
    },
  });
  created.outsiderUserId = outsider.id;
  await prisma.userWallet.create({ data: { userId: outsider.id } });

  const appt1 = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doctor.id,
      type: "ONLINE",
      status: "CONFIRMED",
    },
  });
  const appt2 = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doctor.id,
      type: "ONLINE",
      status: "CONFIRMED",
    },
  });
  created.appts.push(appt1.id, appt2.id);

  const patientTok = await login("/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const doctorTok = await login("/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const adminTok = await login("/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const outsiderTok = await login("/auth/user/login", {
    mobile: "08000009999",
    password: "test1234",
  });

  // ── Consent state machine ────────────────────────────────
  console.log("\nConsent state machine");
  let r = await call(
    "GET",
    `/appointments/${appt1.id}/recording-consent`,
    null,
    patientTok,
  );
  assert(
    ok(r.status) && r.data?.status === "NOT_REQUESTED",
    "fresh appointment → consent NOT_REQUESTED",
  );

  r = await call(
    "POST",
    `/appointments/${appt1.id}/recording-consent/request`,
    {},
    patientTok,
  );
  assert(ok(r.status), "patient can request consent");

  r = await call(
    "GET",
    `/appointments/${appt1.id}/recording-consent`,
    null,
    patientTok,
  );
  assert(r.data?.status === "PENDING", "one-sided request → PENDING");
  assert(
    r.data?.patientConsented === true && r.data?.doctorConsented === false,
    "patient consented, doctor not yet",
  );

  r = await call(
    "PATCH",
    `/appointments/${appt1.id}/recording-consent`,
    { consent: true },
    adminTok,
  );
  assert(r.status === 403, "admin cannot respond to consent (403)");

  r = await call(
    "PATCH",
    `/appointments/${appt1.id}/recording-consent`,
    { consent: true },
    doctorTok,
  );
  assert(ok(r.status), "doctor can respond to consent");
  r = await call(
    "GET",
    `/appointments/${appt1.id}/recording-consent`,
    null,
    doctorTok,
  );
  assert(
    r.data?.status === "CONSENTED" && r.data?.bothConsented === true,
    "both parties consented → CONSENTED",
  );

  // ── Participant gating ───────────────────────────────────
  console.log("\nParticipant gating");
  r = await call(
    "GET",
    `/appointments/${appt1.id}/recording-consent`,
    null,
    outsiderTok,
  );
  assert(r.status === 403, "non-participant cannot read consent (403)");
  r = await call(
    "GET",
    `/appointments/${appt1.id}/recording/assets`,
    null,
    outsiderTok,
  );
  assert(r.status === 403, "non-participant cannot list assets (403)");

  // ── Session guards (no real Zego) ────────────────────────
  console.log("\nSession guards");
  r = await call(
    "GET",
    `/appointments/${appt1.id}/recording`,
    null,
    patientTok,
  );
  assert(
    ok(r.status) && r.data?.status === "NOT_STARTED",
    "no session yet → NOT_STARTED",
  );
  r = await call(
    "POST",
    `/appointments/${appt1.id}/recording/start`,
    {},
    adminTok,
  );
  assert(r.status === 403, "admin cannot start recording (403)");
  r = await call(
    "POST",
    `/appointments/${appt2.id}/recording/start`,
    {},
    patientTok,
  );
  assert(r.status === 400, "cannot start without consent (400)");

  // ── Decline path (appt2) ─────────────────────────────────
  console.log("\nDecline path");
  await call(
    "POST",
    `/appointments/${appt2.id}/recording-consent/request`,
    {},
    patientTok,
  );
  r = await call(
    "PATCH",
    `/appointments/${appt2.id}/recording-consent`,
    { consent: false },
    doctorTok,
  );
  assert(ok(r.status), "doctor can decline consent");
  r = await call(
    "GET",
    `/appointments/${appt2.id}/recording-consent`,
    null,
    patientTok,
  );
  assert(r.data?.status === "DECLINED", "declined consent → DECLINED");
  r = await call(
    "POST",
    `/appointments/${appt2.id}/recording-consent/request`,
    {},
    patientTok,
  );
  assert(r.status === 400, "cannot re-request after decline (400)");

  // ── Assets ───────────────────────────────────────────────
  console.log("\nAssets");
  const assetBody = {
    files: [
      {
        objectKey: `consultations/${appt1.id}/rec.mp4`,
        storageVendor: "manual",
        providerUrl: "https://example.com/rec.mp4",
        fileName: "rec.mp4",
        mimeType: "video/mp4",
      },
    ],
  };
  r = await call(
    "POST",
    `/appointments/${appt1.id}/recording/assets`,
    assetBody,
    patientTok,
  );
  assert(r.status === 403, "patient cannot register assets (403, admin only)");
  r = await call(
    "POST",
    `/appointments/${appt1.id}/recording/assets`,
    assetBody,
    adminTok,
  );
  assert(
    ok(r.status) && Array.isArray(r.data?.assets) && r.data.assets.length === 1,
    "admin registers a recording asset",
  );
  const assetId = r.data?.assets?.[0]?.id;

  r = await call(
    "GET",
    `/appointments/${appt1.id}/recording/assets`,
    null,
    patientTok,
  );
  assert(
    ok(r.status) && r.data?.length === 1,
    "participant can list the asset",
  );

  r = await call(
    "GET",
    `/appointments/${appt1.id}/recording/assets/${assetId}/access`,
    null,
    patientTok,
  );
  assert(
    r.status === 403,
    "playback denied without a recording-playback plan (403)",
  );

  // ── Export / delete requests ─────────────────────────────
  console.log("\nExport / delete requests");
  r = await call(
    "POST",
    `/appointments/${appt1.id}/recording/requests`,
    { type: "EXPORT" },
    patientTok,
  );
  assert(ok(r.status), "patient can create an EXPORT request");
  r = await call(
    "POST",
    `/appointments/${appt1.id}/recording/requests`,
    { type: "DELETE" },
    doctorTok,
  );
  assert(
    r.status === 403,
    "doctor cannot request DELETE (403, patient/admin only)",
  );
  r = await call(
    "GET",
    `/appointments/${appt1.id}/recording/requests`,
    null,
    patientTok,
  );
  assert(
    ok(r.status) && Array.isArray(r.data) && r.data.length >= 1,
    "requests are listed",
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} assertion(s) failed`);
}

main()
  .then(cleanup)
  .then(async () => {
    await prisma.$disconnect();
    console.log("\n✅ Recording lifecycle test passed");
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("\n❌", e.message);
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
