// Live verification of the user referral bonus program:
//  - 10-char code generated at signup; signup-with-code links referredById
//    (case-insensitive); invalid codes are rejected
//  - profile exposes the code + referral stats + configured bonus
//  - the referrer is credited (exactly the configured naira, in kobo) when the
//    referred user PAYS for their first appointment — narration, WALLET_TOPUP
//    ledger, notification — and NEVER twice (idempotency on a 2nd payment)
//  - bonus setting at 0 → no credit, claim left open for later enabling
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const createdUserIds = [];
const stamp = Date.now() % 100_000_000;

async function registerUser(name, suffix, referralCode) {
  const r = await call("POST", "/auth/user/register", {
    name,
    mobile: `070${stamp + suffix}`,
    password: "test1234",
    ...(referralCode ? { referralCode } : {}),
  });
  if (r.status < 300) {
    const row = await prisma.user.findFirst({
      where: { mobile: `070${stamp + suffix}` },
      select: { id: true, referralCode: true, referredById: true },
    });
    if (row) createdUserIds.push(row.id);
    return { res: r, row, token: data(r)?.accessToken };
  }
  return { res: r, row: null, token: null };
}

(async () => {
  const testStart = new Date();
  const referrer = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, name: true, referralCode: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  if (!referrer?.referralCode || !doc)
    throw new Error("seed data missing — run backfill-referral-codes first");

  const originalSetting = await prisma.setting.findUnique({
    where: { key: "referral_bonus_amount" },
  });
  await prisma.setting.upsert({
    where: { key: "referral_bonus_amount" },
    update: { value: "1000" },
    create: { key: "referral_bonus_amount", value: "1000" },
  });
  await prisma.doctor.update({
    where: { id: doc.id },
    data: { isOnline: true, instantDayFee: 800000, instantNightFee: 800000 },
  });
  const refWalletBefore = (
    await prisma.userWallet.upsert({
      where: { userId: referrer.id },
      update: {},
      create: { userId: referrer.id },
    })
  ).balance;

  // ── 1) code generation + signup-with-code ──
  console.log("\n1) Codes at signup");
  const a = await registerUser("Ref Test Alpha", 1);
  assert(a.res.status < 300, "plain signup works");
  assert(
    /^[A-HJ-KM-NP-Z2-9]{10}$/.test(a.row?.referralCode ?? ""),
    `new user gets a 10-char code (${a.row?.referralCode})`,
  );
  assert(a.row?.referredById === null, "no code → no referrer");

  const b = await registerUser(
    "Ref Test Beta",
    2,
    referrer.referralCode.toLowerCase(), // prove case-insensitivity
  );
  assert(
    b.row?.referredById === referrer.id,
    "signup with a code links the referrer (case-insensitive)",
  );
  assert(
    a.row?.referralCode !== b.row?.referralCode,
    "codes are unique per user",
  );
  const bad = await call("POST", "/auth/user/register", {
    name: "Bad Code",
    mobile: `070${stamp + 3}`,
    password: "test1234",
    referralCode: "NOSUCHCODE",
  });
  assert(bad.status === 400, "invalid referral code → 400");

  // ── 2) profile exposes the program ──
  console.log("\n2) Profile");
  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const refTok = data(pl)?.accessToken;
  const profile = data(await call("GET", "/users/profile", null, refTok));
  assert(
    profile?.referralCode === referrer.referralCode,
    "profile carries my code",
  );
  assert(
    profile?.referral?.referred >= 1,
    `referred count (${profile?.referral?.referred})`,
  );
  assert(
    profile?.referral?.bonusKobo === 100000,
    "configured bonus surfaced (₦1,000 in kobo)",
  );

  // ── 3) the qualifying first payment pays the referrer ──
  console.log("\n3) Reward on first paid appointment");
  await prisma.userWallet.upsert({
    where: { userId: b.row.id },
    update: { balance: 5_000_000 },
    create: { userId: b.row.id, balance: 5_000_000 },
  });
  const book1 = await call(
    "POST",
    "/appointments",
    {
      doctorId: doc.id,
      type: "ONLINE",
      mode: "INSTANT",
      paymentMethod: "WALLET",
    },
    b.token,
  );
  assert(book1.status < 300, `referred user books + pays (${book1.status})`);
  await sleep(1500); // reward path is fire-and-forget

  const refWalletAfter = (
    await prisma.userWallet.findUnique({ where: { userId: referrer.id } })
  ).balance;
  assert(
    refWalletAfter === refWalletBefore + 100000,
    `referrer credited exactly ₦1,000 (${refWalletBefore} → ${refWalletAfter})`,
  );
  const bRow = await prisma.user.findUnique({
    where: { id: b.row.id },
    select: { referralRewardedAt: true },
  });
  assert(!!bRow?.referralRewardedAt, "referred user marked as rewarded");
  const hist = await prisma.userWalletHistory.findFirst({
    where: {
      wallet: { userId: referrer.id },
      type: "REFERRAL_COMMISSION",
      createdAt: { gte: testStart },
    },
  });
  assert(
    hist?.amount === 100000 && hist?.description.includes("Referral bonus"),
    `wallet narration: "${hist?.description}"`,
  );
  const txn = await prisma.paymentTransaction.findUnique({
    where: { reference: `refbonus_${b.row.id}` },
  });
  assert(
    txn?.type === "WALLET_TOPUP" &&
      txn?.channel === "referral_bonus" &&
      txn?.status === "SUCCESS",
    "WALLET_TOPUP ledger row (channel referral_bonus)",
  );
  const notif = await prisma.notification.findFirst({
    where: {
      userId: referrer.id,
      type: "referral_bonus",
      createdAt: { gte: testStart },
    },
  });
  assert(
    !!notif && notif.title.includes("referral bonus"),
    "referrer notified 🎉",
  );

  // ── 4) never twice ──
  console.log("\n4) Idempotency");
  const book2 = await call(
    "POST",
    "/appointments",
    {
      doctorId: doc.id,
      type: "ONLINE",
      mode: "INSTANT",
      paymentMethod: "WALLET",
    },
    b.token,
  );
  assert(book2.status < 300, "referred user books a SECOND time");
  await sleep(1500);
  const refWalletFinal = (
    await prisma.userWallet.findUnique({ where: { userId: referrer.id } })
  ).balance;
  assert(
    refWalletFinal === refWalletAfter,
    "no second bonus — one reward per referred user, ever",
  );

  // ── 5) program off → claim stays open ──
  console.log("\n5) Bonus setting at 0");
  await prisma.setting.update({
    where: { key: "referral_bonus_amount" },
    data: { value: "0" },
  });
  const c = await registerUser("Ref Test Gamma", 4, referrer.referralCode);
  await prisma.userWallet.upsert({
    where: { userId: c.row.id },
    update: { balance: 5_000_000 },
    create: { userId: c.row.id, balance: 5_000_000 },
  });
  const book3 = await call(
    "POST",
    "/appointments",
    {
      doctorId: doc.id,
      type: "ONLINE",
      mode: "INSTANT",
      paymentMethod: "WALLET",
    },
    c.token,
  );
  assert(book3.status < 300, "third referred user pays while program is off");
  await sleep(1500);
  const cRow = await prisma.user.findUnique({
    where: { id: c.row.id },
    select: { referralRewardedAt: true },
  });
  assert(
    cRow?.referralRewardedAt === null,
    "no credit AND claim left open (enabling the setting later still rewards)",
  );
  assert(
    (await prisma.userWallet.findUnique({ where: { userId: referrer.id } }))
      .balance === refWalletFinal,
    "referrer balance untouched while program is off",
  );

  // ── cleanup ──
  await prisma.setting.update({
    where: { key: "referral_bonus_amount" },
    data: { value: originalSetting?.value ?? "0" },
  });
  await prisma.paymentTransaction.deleteMany({
    where: {
      OR: [
        { reference: { in: createdUserIds.map((id) => `refbonus_${id}`) } },
        { userId: { in: createdUserIds } },
      ],
    },
  });
  await prisma.userWalletHistory.deleteMany({
    where: {
      wallet: { userId: referrer.id },
      type: "REFERRAL_COMMISSION",
      createdAt: { gte: testStart },
    },
  });
  await prisma.appointment.deleteMany({
    where: { userId: { in: createdUserIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.userWallet.update({
    where: { userId: referrer.id },
    data: { balance: refWalletBefore },
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  try {
    await prisma.appointment.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  } catch {}
  await prisma.$disconnect();
  process.exit(1);
});
