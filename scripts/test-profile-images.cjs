const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

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
const isData = (v) => String(v || "").startsWith("data:image");

(async () => {
  const u0 = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, image: true },
  });
  const d0 = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true, image: true, bannerImage: true },
  });

  // Patient avatar
  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const pt = data(pl)?.accessToken;
  const pa = await call("PATCH", "/users/profile/avatar", { dataUrl: PNG }, pt);
  const pg = await call("GET", "/users/profile", null, pt);
  console.log(
    "1) patient login:",
    pl.status,
    "| avatar PATCH:",
    pa.status,
    "| profile.image is data-URL:",
    isData(data(pg)?.image),
  );

  // Doctor avatar + banner
  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const dt = data(dl)?.accessToken;
  console.log("2) doctor login:", dl.status, "token:", !!dt);
  if (dt) {
    const da = await call("PATCH", "/doctors/me/avatar", { dataUrl: PNG }, dt);
    const dbn = await call("PATCH", "/doctors/me/banner", { dataUrl: PNG }, dt);
    const dg = await call("GET", "/doctors/me/profile", null, dt);
    console.log(
      "   avatar PATCH:",
      da.status,
      "| banner PATCH:",
      dbn.status,
      "| image:",
      isData(data(dg)?.image),
      "| bannerImage:",
      isData(data(dg)?.bannerImage),
    );
  }

  // Public doctor detail returns bannerImage
  if (d0) {
    const pub = await call("GET", `/doctors/${d0.id}`);
    console.log(
      "3) public /doctors/:id -> image:",
      isData(data(pub)?.image),
      "| bannerImage:",
      isData(data(pub)?.bannerImage),
    );
  }

  // restore originals
  if (u0)
    await prisma.user.update({
      where: { id: u0.id },
      data: { image: u0.image },
    });
  if (d0)
    await prisma.doctor.update({
      where: { id: d0.id },
      data: { image: d0.image, bannerImage: d0.bannerImage },
    });
  console.log("restored originals. done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
