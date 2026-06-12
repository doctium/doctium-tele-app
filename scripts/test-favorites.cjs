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
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true, name: true },
  });
  await prisma.favoriteDoctor.deleteMany({
    where: { userId: usr.id, doctorId: doc.id },
  });

  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const token = data(pl)?.accessToken;
  console.log("patient login:", pl.status, "| doctor:", doc.name);

  const before = await call("GET", "/users/favorites/ids", null, token);
  console.log("1) ids before:", JSON.stringify(data(before)));

  const add = await call(
    "POST",
    `/users/favorites/${doc.id}/toggle`,
    {},
    token,
  );
  console.log(
    "2) toggle ->",
    add.status,
    JSON.stringify(data(add)),
    "(expect favorite:true)",
  );

  const ids = await call("GET", "/users/favorites/ids", null, token);
  const list = await call("GET", "/users/favorites", null, token);
  const inIds = (data(ids) ?? []).includes(doc.id);
  const inList = (data(list) ?? []).some(
    (d) => d.id === doc.id && d.name && typeof d.charge === "number",
  );
  console.log(
    "3) after add -> inIds:",
    inIds,
    "| inList(with card fields):",
    inList,
  );

  const rm = await call("POST", `/users/favorites/${doc.id}/toggle`, {}, token);
  const ids2 = await call("GET", "/users/favorites/ids", null, token);
  console.log(
    "4) toggle again ->",
    JSON.stringify(data(rm)),
    "(expect favorite:false) | inIds now:",
    (data(ids2) ?? []).includes(doc.id),
  );

  const bad = await call(
    "POST",
    `/users/favorites/nonexistent-id/toggle`,
    {},
    token,
  );
  console.log("5) toggle bad doctor ->", bad.status, "(expect 404)");

  await prisma.favoriteDoctor.deleteMany({
    where: { userId: usr.id, doctorId: doc.id },
  });
  console.log("done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
