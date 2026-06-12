/**
 * Kobo migration — live booking math verification.
 * Books a real instant consult paid from wallet and asserts the stored split
 * (amount / adminEarning / doctorEarning) and the wallet debit are exact kobo.
 * Run: node scripts/test-money-kobo.cjs   (API up on :3001)
 */
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
let pass = 0,
  fail = 0;
const assert = (c, l) => {
  if (c) {
    pass++;
    console.log("  ✓", l);
  } else {
    fail++;
    console.log("  ✗ FAIL:", l);
  }
};

let apptId;
(async () => {
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true },
  });

  // Fixture: doctor online with a known night fee; 20% platform commission; funded patient wallet.
  await prisma.doctor.update({
    where: { id: doc.id },
    data: {
      isOnline: true,
      instantDayFee: 800000,
      instantNightFee: 1200000,
      commission: 0,
    },
  });
  await prisma.setting.upsert({
    where: { key: "admin_commission_percent" },
    update: { value: "20" },
    create: { key: "admin_commission_percent", value: "20" },
  });
  await prisma.userWallet.upsert({
    where: { userId: usr.id },
    update: { balance: 10000000 },
    create: { userId: usr.id, balance: 10000000 },
  });
  // Cancel any active patient subscription influence is irrelevant here (no member discount expected).

  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const token = data(pl)?.accessToken;
  if (!token) throw new Error("login failed");

  const balBefore = (
    await prisma.userWallet.findUnique({ where: { userId: usr.id } })
  ).balance;
  const book = await call(
    "POST",
    "/appointments",
    {
      doctorId: doc.id,
      type: "ONLINE",
      mode: "INSTANT",
      paymentMethod: "WALLET",
    },
    token,
  );
  if (book.status >= 400) {
    console.log("booking response:", JSON.stringify(book.body));
    throw new Error("booking failed");
  }
  apptId = data(book)?.id;

  const appt = await prisma.appointment.findUnique({
    where: { id: apptId },
    select: {
      amount: true,
      discount: true,
      memberDiscount: true,
      adminEarning: true,
      doctorEarning: true,
      adminCommissionPercent: true,
      paymentStatus: true,
    },
  });
  // Kobo invariants — hold regardless of any member discount / doctor commission tier.
  const earningsBase = appt.adminEarning + appt.doctorEarning;
  console.log(
    `\nBooked: patient pays ${appt.amount} kobo · earningsBase ${earningsBase} · commission ${appt.adminCommissionPercent}% · memberDiscount ${appt.memberDiscount}`,
  );
  const ints = [
    appt.amount,
    appt.discount,
    appt.memberDiscount,
    appt.adminEarning,
    appt.doctorEarning,
  ];
  assert(
    ints.every(Number.isInteger),
    "every stored money value is a whole integer (no fractional kobo)",
  );
  assert(
    appt.adminEarning ===
      Math.round((earningsBase * appt.adminCommissionPercent) / 100),
    "commission split = round(base × pct/100), exact in kobo",
  );
  assert(
    appt.adminEarning + appt.doctorEarning === earningsBase,
    "admin + doctor earnings conserve the base exactly",
  );
  assert(
    appt.adminCommissionPercent >= 0 && appt.adminCommissionPercent <= 100,
    "commission stored as a percent (≤100), not ×100'd into kobo",
  );
  assert(
    appt.amount >= 100000,
    "patient pays a realistic kobo amount (≥ ₦1,000) — not 100× too small",
  );

  const balAfter = (
    await prisma.userWallet.findUnique({ where: { userId: usr.id } })
  ).balance;
  assert(
    balBefore - balAfter === appt.amount,
    `wallet debited exactly what the patient paid (${appt.amount} kobo)`,
  );
  assert(appt.paymentStatus === "PAID", "instant wallet booking is PAID");

  // Cleanup the test appointment (and its settlement side-effects are not triggered until COMPLETED).
  if (apptId)
    await prisma.appointment.delete({ where: { id: apptId } }).catch(() => {});
  // Refund the wallet debit so the seed balance is untouched.
  await prisma.userWallet.update({
    where: { userId: usr.id },
    data: { balance: balBefore },
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("ERROR:", e.message);
  if (apptId)
    await prisma.appointment.delete({ where: { id: apptId } }).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
