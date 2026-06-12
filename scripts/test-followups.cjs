/**
 * Follow-up & no-show-recovery automation — end-to-end verification.
 *  - Completing a consult auto-queues 48h + 7d wellbeing check-ins
 *  - Doctor recall ("come back in N days")
 *  - Due follow-ups get delivered (status SENT + notification row)
 *  - No-show detection → recovery follow-up
 *
 * Run: node scripts/test-followups.cjs   (API must be up on :3001)
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

const apptIds = [];
let patientId, doctorId;
const cleanup = async () => {
  if (patientId)
    await prisma.followUp.deleteMany({ where: { userId: patientId } });
  if (apptIds.length)
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
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
  if (!doc || !patient) throw new Error("Seeds missing.");
  doctorId = doc.id;
  patientId = patient.id;
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
    throw new Error("Login failed.");

  // A confirmed, paid, already-settled appointment (settlement skipped; follow-ups still fire).
  const appt = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doc.id,
      date: "2026-06-20",
      time: "10:00",
      duration: 30,
      status: "CONFIRMED",
      mode: "SCHEDULED",
      paymentStatus: "PAID",
      isSettled: true,
    },
    select: { id: true },
  });
  apptIds.push(appt.id);

  console.log("\n1) Doctor recall — 'come back in N days'");
  const recall = await call(
    "POST",
    "/follow-ups",
    { appointmentId: appt.id, inDays: 14, note: "Review BP" },
    doctorToken,
  );
  assert(
    recall.status === 201 || recall.status === 200,
    "doctor schedule accepted",
  );
  assert(data(recall)?.type === "DOCTOR_SCHEDULED", "type DOCTOR_SCHEDULED");
  const dueInDays =
    (new Date(data(recall)?.scheduledFor).getTime() - Date.now()) / 86400000;
  assert(dueInDays > 13 && dueInDays < 15, "scheduled ~14 days out");
  const foreign = await call(
    "POST",
    "/follow-ups",
    { appointmentId: "nonexistent", inDays: 7 },
    doctorToken,
  );
  assert(
    foreign.status === 404 || foreign.status === 403,
    "cannot schedule for unknown/foreign appointment",
  );

  console.log("\n2) Completing the consult auto-queues 48h + 7d check-ins");
  const complete = await call(
    "PATCH",
    `/appointments/${appt.id}/status`,
    { status: "COMPLETED" },
    doctorToken,
  );
  assert(complete.status === 200, "appointment marked COMPLETED");
  // give the fire-and-forget scheduling a beat
  await new Promise((r) => setTimeout(r, 600));
  const checks = await prisma.followUp.findMany({
    where: {
      appointmentId: appt.id,
      type: { in: ["CHECK_IN_48H", "CHECK_IN_7D"] },
    },
  });
  assert(checks.length === 2, "two wellbeing check-ins queued (48h + 7d)");
  const c48 = checks.find((c) => c.type === "CHECK_IN_48H");
  const h = c48
    ? (new Date(c48.scheduledFor).getTime() - Date.now()) / 3600000
    : 0;
  assert(h > 47 && h < 49, "48h check-in scheduled ~48h out");
  const apptAfter = await prisma.appointment.findUnique({
    where: { id: appt.id },
    select: { followUpsScheduled: true },
  });
  assert(
    apptAfter?.followUpsScheduled === true,
    "appointment flagged followUpsScheduled (idempotent)",
  );

  console.log("\n3) Due follow-ups get delivered");
  // Make the recall due now.
  await prisma.followUp.updateMany({
    where: { appointmentId: appt.id, type: "DOCTOR_SCHEDULED" },
    data: { scheduledFor: new Date(Date.now() - 1000) },
  });
  const beforeNotif = await prisma.notification.count({
    where: { userId: patient.id },
  });
  const run = await call("POST", "/admin/run-follow-ups", {}, adminToken);
  assert(run.status === 200 || run.status === 201, "admin run-follow-ups 200");
  assert((data(run)?.delivered ?? 0) >= 1, "at least one follow-up delivered");
  const recallRow = await prisma.followUp.findFirst({
    where: { appointmentId: appt.id, type: "DOCTOR_SCHEDULED" },
  });
  assert(
    recallRow?.status === "SENT" && recallRow?.sentAt,
    "delivered follow-up marked SENT with sentAt",
  );
  const afterNotif = await prisma.notification.count({
    where: { userId: patient.id },
  });
  assert(
    afterNotif > beforeNotif,
    "in-app notification row created for the patient",
  );

  console.log("\n4) No-show detection → recovery follow-up");
  const off = 60; // APP_TIMEZONE_OFFSET default +01:00
  const todayStr = new Date(Date.now() + off * 60000)
    .toISOString()
    .slice(0, 10);
  const missed = await prisma.appointment.create({
    data: {
      userId: patient.id,
      doctorId: doc.id,
      date: todayStr,
      time: "00:05",
      duration: 30,
      status: "CONFIRMED",
      mode: "SCHEDULED",
      paymentStatus: "PAID",
    },
    select: { id: true },
  });
  apptIds.push(missed.id);
  const run2 = await call("POST", "/admin/run-follow-ups", {}, adminToken);
  assert((data(run2)?.noShowsDetected ?? 0) >= 1, "no-show detected");
  const missedAfter = await prisma.appointment.findUnique({
    where: { id: missed.id },
    select: { noShowAt: true },
  });
  assert(missedAfter?.noShowAt != null, "appointment flagged noShowAt");
  const recovery = await prisma.followUp.findFirst({
    where: { appointmentId: missed.id, type: "MISSED_RECOVERY" },
  });
  assert(recovery != null, "MISSED_RECOVERY follow-up created");
  assert(
    recovery?.status === "SENT",
    "recovery follow-up delivered in same sweep",
  );

  console.log("\n5) Patient sees their follow-ups");
  const mine = await call("GET", "/follow-ups/mine", null, patientToken);
  assert(
    mine.status === 200 && Array.isArray(data(mine)) && data(mine).length >= 1,
    "GET /follow-ups/mine returns the patient's follow-ups",
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
