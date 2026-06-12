const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";
const stamp = Date.now().toString().slice(-7);
const email = `drnew${stamp}@doctium.com`;
const phone = `0809${stamp}`;

const post = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let j;
  try {
    j = await r.json();
  } catch {
    j = {};
  }
  return { status: r.status, body: j };
};

(async () => {
  // cleanup
  await prisma.doctorWallet
    .deleteMany({ where: { doctor: { email } } })
    .catch(() => {});
  await prisma.doctor.deleteMany({ where: { email } });
  await prisma.otp.deleteMany({
    where: { OR: [{ email }, { mobile: phone }] },
  });

  // 1) send OTP
  const s1 = await post("/auth/doctor/register/send-otp", { email, phone });
  const d1 = s1.body.data ?? s1.body;
  console.log(
    "1) send-otp ->",
    s1.status,
    "codes:",
    d1.devEmailCode,
    d1.devPhoneCode,
    "| body:",
    JSON.stringify(s1.body).slice(0, 220),
  );

  // 2) register with correct codes (Consultant -> designation should combine)
  const s2 = await post("/auth/doctor/register", {
    firstName: "New",
    lastName: "Signup",
    email,
    phone,
    password: "test1234",
    speciality: "Consultant",
    consultantSpeciality: "Cardiology",
    emailCode: d1.devEmailCode,
    phoneCode: d1.devPhoneCode,
  });
  console.log(
    "2) register ->",
    s2.status,
    "hasToken:",
    !!(s2.body.data?.accessToken ?? s2.body.accessToken),
  );

  // 3) verify in DB
  const doc = await prisma.doctor.findUnique({
    where: { email },
    select: {
      name: true,
      email: true,
      mobile: true,
      designation: true,
      verificationStatus: true,
      emailVerified: true,
      phoneVerified: true,
    },
  });
  console.log("3) DB doctor ->", JSON.stringify(doc));

  // 4) negative: wrong codes must be rejected
  await prisma.doctor.deleteMany({ where: { email } });
  await prisma.otp.deleteMany({
    where: { OR: [{ email }, { mobile: phone }] },
  });
  await post("/auth/doctor/register/send-otp", { email, phone });
  const s4 = await post("/auth/doctor/register", {
    firstName: "X",
    lastName: "Y",
    email,
    phone,
    password: "test1234",
    speciality: "General Practitioner",
    emailCode: "000000",
    phoneCode: "000000",
  });
  console.log(
    "4) wrong-code register ->",
    s4.status,
    "(expect 400)",
    s4.body.message ?? "",
  );

  // 5) confirm admin email recipients resolve (same query the API uses to notify)
  const reviewers = await prisma.employee.findMany({
    where: {
      isActive: true,
      email: { not: "" },
      OR: [
        { isSuperAdmin: true },
        {
          role: {
            permissions: { hasSome: ["doctors.verify", "doctors.manage"] },
          },
        },
      ],
    },
    select: { email: true, isSuperAdmin: true },
  });
  console.log(
    "5) admin recipients ->",
    reviewers.map((r) => r.email),
  );
  const base = (process.env.PUBLIC_WEB_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  console.log("   review link ->", `${base}/doctors/<doctorId>`);

  // cleanup
  await prisma.doctor.deleteMany({ where: { email } });
  await prisma.otp.deleteMany({
    where: { OR: [{ email }, { mobile: phone }] },
  });
  console.log("done.");
})()
  .catch((e) => console.error("ERR", e))
  .finally(() => process.exit(0));
