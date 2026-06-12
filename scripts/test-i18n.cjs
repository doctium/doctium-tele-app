/**
 * i18n / multi-language verification.
 *
 *   node --env-file=.env scripts/test-i18n.cjs
 *
 * Covers the Phase-1 backend surface of the multi-language feature:
 *   1. Doctor discovery `?language=` filter (Doctor.language array overlap)
 *   2. Doctor self-signup persists the languages he speaks (DTO + create path)
 *   3. User.preferredLanguage round-trips through PATCH/GET /users/profile
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";

let pass = 0;
let fail = 0;
const ok = (label, cond) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  cond ? pass++ : fail++;
};

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
const eqArr = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((x) => b.includes(x));

(async () => {
  // ── 1) Doctor discovery language filter ───────────────────────────────
  const docs = await prisma.doctor.findMany({
    where: { isDelete: false },
    take: 2,
    select: { id: true, language: true, isVerified: true, isBlock: true },
  });
  if (docs.length < 2) {
    console.log("Need at least 2 doctors in the DB to test the filter.");
  } else {
    const [A, B] = docs;
    const orig = JSON.parse(JSON.stringify(docs));
    // Make both discoverable, with distinct spoken languages.
    await prisma.doctor.update({
      where: { id: A.id },
      data: { language: ["en", "yo"], isVerified: true, isBlock: false },
    });
    await prisma.doctor.update({
      where: { id: B.id },
      data: { language: ["en", "ha"], isVerified: true, isBlock: false },
    });

    const yo = data(await call("GET", "/doctors?language=yo"));
    const ha = data(await call("GET", "/doctors?language=ha"));
    const all = data(await call("GET", "/doctors"));
    const zz = data(await call("GET", "/doctors?language=zz"));
    const ids = (arr) => (Array.isArray(arr) ? arr.map((d) => d.id) : []);

    ok("1a) ?language=yo includes the Yoruba speaker", ids(yo).includes(A.id));
    ok(
      "1b) ?language=yo excludes the non-Yoruba speaker",
      !ids(yo).includes(B.id),
    );
    ok("1c) ?language=ha includes the Hausa speaker", ids(ha).includes(B.id));
    ok(
      "1d) ?language=ha excludes the non-Hausa speaker",
      !ids(ha).includes(A.id),
    );
    ok(
      "1e) no filter returns both doctors",
      ids(all).includes(A.id) && ids(all).includes(B.id),
    );
    ok(
      "1f) unknown language code returns no match (no crash)",
      Array.isArray(zz) && !ids(zz).includes(A.id) && !ids(zz).includes(B.id),
    );
    ok(
      "1g) discovery payload carries the language array",
      Array.isArray((yo[0] || {}).language),
    );

    // Restore originals.
    for (const d of orig) {
      await prisma.doctor.update({
        where: { id: d.id },
        data: {
          language: d.language,
          isVerified: d.isVerified,
          isBlock: d.isBlock,
        },
      });
    }
  }

  // ── 2) Doctor self-signup persists spoken languages ───────────────────
  const stamp = Date.now();
  const email = `i18n.doc.${stamp}@doctium.test`;
  const phone = `0900${String(stamp).slice(-7)}`;
  const otp = await call("POST", "/auth/doctor/register/send-otp", {
    email,
    phone,
  });
  const emailCode = data(otp)?.devEmailCode;
  const phoneCode = data(otp)?.devPhoneCode;
  ok("2a) send-otp returns dev codes", !!emailCode && !!phoneCode);

  const reg = await call("POST", "/auth/doctor/register", {
    firstName: "Ngozi",
    lastName: "Speaks",
    email,
    phone,
    password: "test1234",
    speciality: "General Practitioner",
    languages: ["en", "yo"],
    emailCode,
    phoneCode,
  });
  ok("2b) doctor register succeeds", !!data(reg)?.accessToken);

  const createdDoc = await prisma.doctor.findFirst({
    where: { email },
    select: { id: true, language: true },
  });
  ok(
    "2c) signup persisted the spoken languages",
    eqArr(createdDoc?.language, ["en", "yo"]),
  );

  // Cleanup the test doctor.
  if (createdDoc) {
    await prisma.doctorWallet
      .deleteMany({ where: { doctorId: createdDoc.id } })
      .catch(() => {});
    await prisma.doctor
      .delete({ where: { id: createdDoc.id } })
      .catch(() => {});
  }
  await prisma.otp
    .deleteMany({ where: { OR: [{ email }, { mobile: phone }] } })
    .catch(() => {});

  // ── 3) User.preferredLanguage round-trip ──────────────────────────────
  const login = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const token = data(login)?.accessToken;
  ok("3a) patient login", !!token);

  if (token) {
    await call("PATCH", "/users/profile", { preferredLanguage: "ha" }, token);
    const prof = data(await call("GET", "/users/profile", null, token));
    ok(
      "3b) preferredLanguage saved + returned by getProfile",
      prof?.preferredLanguage === "ha",
    );

    // Restore the default so the seed account is unchanged.
    await call("PATCH", "/users/profile", { preferredLanguage: "en" }, token);
    const back = data(await call("GET", "/users/profile", null, token));
    ok(
      "3c) preferredLanguage restored to en",
      back?.preferredLanguage === "en",
    );
  }

  console.log(
    `\n${pass}/${pass + fail} passed${fail ? ` — ${fail} FAILED` : ""}`,
  );
})()
  .catch((e) => {
    console.error("ERR", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
