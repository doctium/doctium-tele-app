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

// Build business-local (+01:00) date/time strings for `msFromNow` ahead.
function localDateTime(msFromNow) {
  const d = new Date(Date.now() + msFromNow + 60 * 60000);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const token = data(al)?.accessToken;
  console.log("admin login:", al.status);

  await prisma.notification.deleteMany({
    where: { type: "appointment_reminder" },
  });

  // ── 30-minute reminder ──
  const t30 = localDateTime(30 * 60000);
  const appt = await prisma.appointment.create({
    data: {
      userId: usr.id,
      doctorId: doc.id,
      date: t30.date,
      time: t30.time,
      status: "CONFIRMED",
      mode: "SCHEDULED",
    },
    select: { id: true },
  });
  const run30 = await call(
    "POST",
    "/admin/run-appointment-reminders",
    {},
    token,
  );
  console.log("30-min pass ->", run30.status, JSON.stringify(data(run30)));
  let a = await prisma.appointment.findUnique({
    where: { id: appt.id },
    select: { reminded30: true },
  });
  let nu = await prisma.notification.count({
    where: { userId: usr.id, type: "appointment_reminder" },
  });
  let nd = await prisma.notification.count({
    where: { doctorId: doc.id, type: "appointment_reminder" },
  });
  console.log(
    "  reminded30:",
    a.reminded30,
    "| patient notif:",
    nu,
    "| doctor notif:",
    nd,
  );

  // ── 5-minute reminder (move start to +5, leave reminded5 false) ──
  const t5 = localDateTime(5 * 60000);
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { date: t5.date, time: t5.time, reminded5: false },
  });
  const run5 = await call(
    "POST",
    "/admin/run-appointment-reminders",
    {},
    token,
  );
  console.log("5-min pass  ->", run5.status, JSON.stringify(data(run5)));
  a = await prisma.appointment.findUnique({
    where: { id: appt.id },
    select: { reminded5: true },
  });
  nu = await prisma.notification.count({
    where: { userId: usr.id, type: "appointment_reminder" },
  });
  console.log(
    "  reminded5:",
    a.reminded5,
    "| patient reminder notifs total:",
    nu,
  );

  // ── idempotency: another pass sends nothing new ──
  const runAgain = await call(
    "POST",
    "/admin/run-appointment-reminders",
    {},
    token,
  );
  console.log("re-run (expect 0/0) ->", JSON.stringify(data(runAgain)));

  // cleanup
  await prisma.appointment.delete({ where: { id: appt.id } });
  await prisma.notification.deleteMany({
    where: { type: "appointment_reminder" },
  });
  console.log("done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
