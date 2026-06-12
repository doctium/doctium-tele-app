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
const msg = (r) => r.body.message ?? data(r)?.message ?? "";

(async () => {
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true, isBlock: true },
  });
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, isBlock: true },
  });
  if (!doc || !usr) {
    console.log("missing test doctor/user", { doc: !!doc, usr: !!usr });
    return;
  }

  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const token = data(al)?.accessToken;
  console.log("admin login:", al.status, "token:", !!token);

  // ── DOCTOR ──
  await call(
    "PATCH",
    `/admin/doctors/${doc.id}/block`,
    { isBlock: true },
    token,
  );
  const dRow = await prisma.doctor.findUnique({
    where: { id: doc.id },
    select: { isBlock: true },
  });
  const dNotif = await prisma.notification.count({
    where: { doctorId: doc.id, type: "account_blocked" },
  });
  const dLogin = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  console.log(
    "DOCTOR blocked ->",
    dRow.isBlock,
    "| notif rows:",
    dNotif,
    "| login:",
    dLogin.status,
    "|",
    msg(dLogin).slice(0, 70),
  );
  await call(
    "PATCH",
    `/admin/doctors/${doc.id}/block`,
    { isBlock: false },
    token,
  );
  const dLogin2 = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  console.log("DOCTOR unblocked -> login:", dLogin2.status, "(expect 201)");

  // ── USER (password + OTP) ──
  await call("PATCH", `/admin/users/${usr.id}/block`, { isBlock: true }, token);
  const uRow = await prisma.user.findUnique({
    where: { id: usr.id },
    select: { isBlock: true },
  });
  const uNotif = await prisma.notification.count({
    where: { userId: usr.id, type: "account_blocked" },
  });
  const uLogin = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  console.log(
    "USER blocked ->",
    uRow.isBlock,
    "| notif rows:",
    uNotif,
    "| pwd login:",
    uLogin.status,
    "|",
    msg(uLogin).slice(0, 70),
  );

  // OTP login while blocked
  await call("POST", "/auth/user/otp/send", { mobile: "08000000002" });
  const otpRow = await prisma.otp.findFirst({
    where: { mobile: "08000000002" },
    orderBy: { createdAt: "desc" },
  });
  const uOtp = await call("POST", "/auth/user/otp/verify", {
    mobile: "08000000002",
    otp: otpRow?.otp,
  });
  console.log(
    "USER blocked -> OTP login:",
    uOtp.status,
    "(expect 401)",
    "|",
    msg(uOtp).slice(0, 50),
  );

  await call(
    "PATCH",
    `/admin/users/${usr.id}/block`,
    { isBlock: false },
    token,
  );
  const uLogin2 = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  console.log("USER unblocked -> pwd login:", uLogin2.status, "(expect 201)");

  // cleanup
  await prisma.doctor.update({
    where: { id: doc.id },
    data: { isBlock: doc.isBlock },
  });
  await prisma.user.update({
    where: { id: usr.id },
    data: { isBlock: usr.isBlock },
  });
  await prisma.notification.deleteMany({
    where: {
      type: "account_blocked",
      OR: [{ doctorId: doc.id }, { userId: usr.id }],
    },
  });
  console.log("restored + cleaned. done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
