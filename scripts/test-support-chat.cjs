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

(async () => {
  // patient login (rxpatient)
  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const ptoken = data(pl)?.accessToken;
  console.log("1) patient login ->", pl.status, "token:", !!ptoken);

  // patient sends a support message
  const sm = await call(
    "POST",
    "/support/messages",
    { type: "TEXT", body: "Hello support, I need help with a booking." },
    ptoken,
  );
  console.log(
    "2) patient send ->",
    sm.status,
    data(sm)?.id ? "message created" : JSON.stringify(data(sm)),
  );

  // admin login
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const atoken = data(al)?.accessToken;
  console.log("3) admin login ->", al.status, "token:", !!atoken);

  // admin unread + inbox
  const uc = await call("GET", "/admin/support/unread-count", null, atoken);
  console.log("4) admin unread-count ->", uc.status, JSON.stringify(data(uc)));
  const th = await call("GET", "/admin/support/threads", null, atoken);
  const items = data(th)?.items ?? [];
  const thread =
    items.find((t) => t.user?.mobile === "08000000002") ?? items[0];
  console.log(
    "   threads ->",
    th.status,
    "count:",
    items.length,
    "| unreadAdmin:",
    thread?.unreadAdmin,
    "| last:",
    thread?.lastMessage,
  );

  // admin replies
  const rep = await call(
    "POST",
    `/admin/support/threads/${thread.id}/messages`,
    { type: "TEXT", body: "Hi! Happy to help — which booking is it?" },
    atoken,
  );
  console.log(
    "5) admin reply ->",
    rep.status,
    data(rep)?.id ? "sent" : JSON.stringify(data(rep)),
  );

  const t1 = await prisma.supportThread.findUnique({
    where: { id: thread.id },
    select: { unreadUser: true },
  });
  console.log(
    "   DB after reply -> patient unreadUser:",
    t1.unreadUser,
    "(expect 1)",
  );

  // patient opens thread -> reply marked read
  const pt = await call("GET", "/support/thread", null, ptoken);
  console.log(
    "6) patient thread ->",
    pt.status,
    "messages:",
    (data(pt)?.messages ?? []).length,
    "(expect 2)",
  );
  const t2 = await prisma.supportThread.findUnique({
    where: { id: thread.id },
    select: { unreadUser: true },
  });
  console.log(
    "   DB after patient open -> unreadUser:",
    t2.unreadUser,
    "(expect 0)",
  );

  // admin opens thread -> unreadAdmin cleared
  await call("GET", `/admin/support/threads/${thread.id}`, null, atoken);
  const uc2 = await call("GET", "/admin/support/unread-count", null, atoken);
  console.log(
    "7) admin unread after open ->",
    JSON.stringify(data(uc2)),
    "(expect 0)",
  );

  // cleanup test data
  await prisma.supportMessage.deleteMany({ where: { threadId: thread.id } });
  await prisma.supportThread.update({
    where: { id: thread.id },
    data: {
      unreadAdmin: 0,
      unreadUser: 0,
      lastMessage: "",
      lastMessageAt: null,
    },
  });
  console.log("done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
