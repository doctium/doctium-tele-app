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
const TITLE = `__test_push_${Date.now()}`;

(async () => {
  // admin login
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const token = data(al)?.accessToken;
  console.log("1) admin login ->", al.status, "token:", !!token);

  // audience counts
  const ac = await call("GET", "/admin/comms/audience-counts", null, token);
  console.log("2) audience-counts ->", ac.status, JSON.stringify(data(ac)));

  // send a PATIENTS broadcast
  const send = await call(
    "POST",
    "/admin/comms/push",
    { audience: "PATIENTS", title: TITLE, body: "Test broadcast body" },
    token,
  );
  const res = data(send);
  console.log("3) send push ->", send.status, JSON.stringify(res));

  // verify in-app Notification rows created for patients
  const notifCount = await prisma.notification.count({
    where: { title: TITLE, recipient: "USER" },
  });
  console.log(
    "4) in-app USER notifications created ->",
    notifCount,
    "(expect == userCount",
    res?.userCount,
    ")",
  );

  // verify broadcast logged + appears in history
  const hist = await call("GET", "/admin/comms/broadcasts", null, token);
  const items = data(hist) ?? [];
  const mine = Array.isArray(items)
    ? items.find((b) => b.title === TITLE)
    : null;
  console.log(
    "5) history ->",
    hist.status,
    "found:",
    mine
      ? `PUSH/${mine.audience} · ${mine.userCount} users · sent ${mine.sentCount} · by ${mine.sentByName}`
      : "NOT FOUND",
  );

  // cleanup
  await prisma.notification.deleteMany({ where: { title: TITLE } });
  await prisma.broadcast.deleteMany({ where: { title: TITLE } });
  console.log("done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
