const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";
const MARK = `__t_${Date.now()}`;

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
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const token = data(al)?.accessToken;
  console.log("1) admin login ->", al.status, "token:", !!token);

  // recipient search
  const rs = await call(
    "GET",
    "/admin/comms/recipients?type=USER",
    null,
    token,
  );
  const people = data(rs) ?? [];
  console.log(
    "2) recipient search (patients) ->",
    rs.status,
    "found:",
    Array.isArray(people) ? people.length : "?",
  );

  // email by audience
  const em = await call(
    "POST",
    "/admin/comms/email",
    {
      mode: "AUDIENCE",
      audience: "PATIENTS",
      subject: `${MARK} email`,
      body: "Hello from Doctium\nLine two.",
    },
    token,
  );
  console.log(
    "3) email (audience PATIENTS) ->",
    em.status,
    JSON.stringify(data(em)),
  );

  // sms to specific recipient (first patient)
  let smsRes = "skipped (no patients)";
  if (people[0]) {
    const sm = await call(
      "POST",
      "/admin/comms/sms",
      {
        mode: "RECIPIENTS",
        recipientType: "USER",
        recipientIds: [people[0].id],
        message: `${MARK} sms hi`,
      },
      token,
    );
    smsRes = `${sm.status} ${JSON.stringify(data(sm))}`;
  }
  console.log("4) sms (specific recipient) ->", smsRes);

  // history filtered by channel
  const eh = await call(
    "GET",
    "/admin/comms/broadcasts?channel=EMAIL",
    null,
    token,
  );
  const sh = await call(
    "GET",
    "/admin/comms/broadcasts?channel=SMS",
    null,
    token,
  );
  const emailFound = (data(eh) ?? []).some((b) => b.title === `${MARK} email`);
  const smsFound = (data(sh) ?? []).some((b) => b.body === `${MARK} sms hi`);
  console.log(
    "5) history EMAIL has ours:",
    emailFound,
    "| SMS has ours:",
    smsFound,
  );
  console.log(
    "   (channel filter works:",
    (data(eh) ?? []).every((b) => b.channel === "EMAIL"),
    "EMAIL-only )",
  );

  // cleanup
  await prisma.broadcast.deleteMany({
    where: {
      OR: [{ title: { contains: MARK } }, { body: { contains: MARK } }],
    },
  });
  console.log("done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
