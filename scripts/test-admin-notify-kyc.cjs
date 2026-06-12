const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";
const stamp = Date.now().toString().slice(-7);
const email = `drnotify${stamp}@doctium.com`;
const phone = `0810${stamp}`;

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
const data = (res) => res.body.data ?? res.body;

(async () => {
  await prisma.doctor.deleteMany({ where: { email } });
  await prisma.otp.deleteMany({
    where: { OR: [{ email }, { mobile: phone }] },
  });

  // 1) doctor signup (should create an AdminNotification)
  const s1 = await call("POST", "/auth/doctor/register/send-otp", {
    email,
    phone,
  });
  const codes = data(s1);
  await call("POST", "/auth/doctor/register", {
    firstName: "Note",
    lastName: "Test",
    email,
    phone,
    password: "test1234",
    speciality: "Senior Registrar",
    emailCode: codes.devEmailCode,
    phoneCode: codes.devPhoneCode,
  });
  const doctorId = (
    await prisma.doctor.findUnique({ where: { email }, select: { id: true } })
  )?.id;
  console.log("1) signup -> doctorId:", doctorId);

  // 2) admin login
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const token = data(al)?.accessToken;
  console.log("2) admin login ->", al.status, "token:", !!token);

  // 3) unread count + list contains the signup notification
  const uc = await call(
    "GET",
    "/admin/notifications/unread-count",
    null,
    token,
  );
  console.log("3) unread-count ->", uc.status, JSON.stringify(data(uc)));
  const list = await call("GET", "/admin/notifications", null, token);
  const items = data(list);
  const mine = Array.isArray(items)
    ? items.find((n) => n.link === `/doctors/${doctorId}`)
    : null;
  console.log(
    "   list ->",
    list.status,
    "items:",
    Array.isArray(items) ? items.length : "?",
    "| signup notif:",
    mine ? `"${mine.title}" → ${mine.link} (read=${mine.read})` : "NOT FOUND",
  );

  // 4) mark read
  if (mine) {
    const mr = await call(
      "PATCH",
      `/admin/notifications/${mine.id}/read`,
      null,
      token,
    );
    const uc2 = await call(
      "GET",
      "/admin/notifications/unread-count",
      null,
      token,
    );
    console.log(
      "4) mark-read ->",
      mr.status,
      "| unread now:",
      JSON.stringify(data(uc2)),
    );
  }

  // 5) admin upload-on-behalf (routing + Cloudinary). A 201 = stored; a 4xx mentioning cloudinary = creds missing.
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const up = await call(
    "POST",
    `/admin/doctors/${doctorId}/kyc-documents`,
    {
      type: "GOVERNMENT_ID",
      dataUrl: png,
      fileName: "id.png",
      mimeType: "image/png",
    },
    token,
  );
  console.log(
    "5) admin upload-on-behalf ->",
    up.status,
    up.status >= 400 ? `(${data(up)?.message ?? "error"})` : "OK stored",
  );

  // cleanup
  await prisma.kycDocument.deleteMany({ where: { doctorId } }).catch(() => {});
  await prisma.doctor.deleteMany({ where: { email } });
  await prisma.otp.deleteMany({
    where: { OR: [{ email }, { mobile: phone }] },
  });
  await prisma.adminNotification.deleteMany({
    where: { link: `/doctors/${doctorId}` },
  });
  console.log("done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
