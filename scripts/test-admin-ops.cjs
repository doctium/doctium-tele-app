// Live verification of the admin-operations pass:
//  - commission precedence: doctor Business Agreement (doctor.commission > 0)
//    BEATS the app-wide `admin_commission_percent` setting; default applies
//    when no agreement — proven via two real wallet bookings' splits
//  - PATCH /admin/doctors/:id/commission (validation, perms, audit row)
//  - Add Funds: exact wallet credit + "Wallet Top-up from Doctium Admin"
//    narration + WALLET_TOPUP ledger + patient notification + audit
//  - "There's a New Patient Booking": real socket.io client in the admins
//    room receives booking:new when a booking is created
//  - GET /admin/appointments/:id order details
const { PrismaClient } = require("@prisma/client");
const { io } = require("socket.io-client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3001/api/v1";
const ORIGIN = "http://localhost:3001";

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

const apptIds = [];
const txnRefs = [];

(async () => {
  const testStart = new Date();
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true, name: true, commission: true },
  });
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, name: true },
  });
  if (!doc || !usr) throw new Error("seed doctor/patient missing");
  const originalSetting = await prisma.setting.findUnique({
    where: { key: "admin_commission_percent" },
  });

  // Neutralize the doctor's DoctiumPlus membership — its commissionPercent
  // benefit lawfully caps the platform cut and would confound the precedence
  // assertions (membership can only LOWER commission, by design).
  const docSub = await prisma.subscription.findUnique({
    where: { doctorId: doc.id },
  });
  if (docSub && docSub.status === "ACTIVE") {
    await prisma.subscription.update({
      where: { id: docSub.id },
      data: { status: "CANCELLED" },
    });
  }

  // Fixtures: doctor bookable instantly, patient wallet funded
  await prisma.doctor.update({
    where: { id: doc.id },
    data: {
      isOnline: true,
      instantDayFee: 1_000_000, // ₦10,000
      instantNightFee: 1_000_000,
      commission: 0, // start with NO business agreement
    },
  });
  await prisma.setting.upsert({
    where: { key: "admin_commission_percent" },
    update: { value: "25" },
    create: { key: "admin_commission_percent", value: "25" },
  });
  const wallet = await prisma.userWallet.upsert({
    where: { userId: usr.id },
    update: { balance: 10_000_000 },
    create: { userId: usr.id, balance: 10_000_000 },
  });

  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const al = await call("POST", "/auth/admin/login", {
    email: "admin@doctium.com",
    password: "admin123",
  });
  const pTok = data(pl)?.accessToken;
  const dTok = data(dl)?.accessToken;
  const aTok = data(al)?.accessToken;
  console.log("logins:", pl.status, dl.status, al.status);
  if (!pTok || !dTok || !aTok) throw new Error("login failed");

  const bookInstant = async () => {
    const r = await call(
      "POST",
      "/appointments",
      {
        doctorId: doc.id,
        type: "ONLINE",
        mode: "INSTANT",
        paymentMethod: "WALLET",
      },
      pTok,
    );
    if (r.status >= 400)
      throw new Error(`booking failed: ${JSON.stringify(r.body)}`);
    const id = data(r)?.id;
    apptIds.push(id);
    txnRefs.push(`appt_${id}`);
    return prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        adminCommissionPercent: true,
        adminEarning: true,
        doctorEarning: true,
        amount: true,
      },
    });
  };

  // ── 1) commission precedence: app-wide default (25%) ──
  console.log("\n1) App-wide default commission");
  const a1 = await bookInstant();
  assert(
    a1.adminCommissionPercent === 25,
    `no agreement → app-wide 25% applies (got ${a1.adminCommissionPercent}%)`,
  );
  assert(
    a1.adminEarning === Math.round((a1.amount * 25) / 100) &&
      a1.adminEarning + a1.doctorEarning === a1.amount,
    `split exact: ${a1.adminEarning} platform / ${a1.doctorEarning} doctor`,
  );

  // ── 2) Business Agreement endpoint + precedence flip ──
  console.log("\n2) Business Agreement (doctor-specific commission)");
  assert(
    (
      await call(
        "PATCH",
        `/admin/doctors/${doc.id}/commission`,
        { commission: 12 },
        dTok,
      )
    ).status === 403,
    "doctor cannot set their own agreement → 403",
  );
  assert(
    (
      await call(
        "PATCH",
        `/admin/doctors/${doc.id}/commission`,
        { commission: 150 },
        aTok,
      )
    ).status === 400,
    "commission above 100 rejected → 400",
  );
  const set12 = await call(
    "PATCH",
    `/admin/doctors/${doc.id}/commission`,
    { commission: 12 },
    aTok,
  );
  assert(
    set12.status < 300 && data(set12)?.commission === 12,
    "admin sets a 12% agreement",
  );
  const audit1 = await prisma.auditLog.findFirst({
    where: {
      action: "doctor.commission",
      entityId: doc.id,
      createdAt: { gte: testStart },
    },
  });
  assert(!!audit1, "agreement change is audit-logged");
  const detail = data(
    await call("GET", `/admin/doctors/${doc.id}`, null, aTok),
  );
  assert(
    detail?.commission === 12 && detail?.defaultCommissionPercent === 25,
    "doctor detail shows agreement (12%) + app-wide default (25%)",
  );

  // socket listener BEFORE the next booking, to catch its alert
  const socket = io(`${ORIGIN}/support`, {
    auth: { token: aTok },
    transports: ["websocket"],
  });
  const alertPromise = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 10_000);
    socket.on("booking:new", (b) => {
      clearTimeout(timer);
      resolve(b);
    });
  });
  await new Promise((resolve) => {
    socket.on("connect", resolve);
    setTimeout(resolve, 5_000);
  });

  const a2 = await bookInstant();
  assert(
    a2.adminCommissionPercent === 12,
    `Business Agreement BEATS the default (got ${a2.adminCommissionPercent}%)`,
  );
  assert(
    a2.adminEarning === Math.round((a2.amount * 12) / 100),
    "12% split exact in kobo",
  );

  // ── 3) booking alert reaches the admins room ──
  console.log("\n3) New-booking alert (socket)");
  const alert = await alertPromise;
  socket.disconnect();
  assert(!!alert, "booking:new received by a logged-in admin socket");
  assert(alert?.id === a2.id, "alert carries the right appointment id");
  assert(
    alert?.patientName === usr.name && alert?.doctorName === doc.name,
    `alert names the parties (${alert?.patientName} → Dr. ${alert?.doctorName})`,
  );

  // ── 4) order-details endpoint ──
  console.log("\n4) Appointment order details");
  const od = await call("GET", `/admin/appointments/${a2.id}`, null, aTok);
  const odB = data(od);
  assert(
    od.status === 200 &&
      odB?.user?.name === usr.name &&
      odB?.doctor?.name === doc.name,
    "admin order-details page data loads",
  );
  assert(
    (await call("GET", "/admin/appointments/nonexistent", null, aTok))
      .status === 404,
    "unknown appointment → 404",
  );
  assert(
    (await call("GET", `/admin/appointments/${a2.id}`, null, dTok)).status ===
      403,
    "doctor blocked from admin order details → 403",
  );

  // ── 5) Add Funds ──
  console.log("\n5) Add Funds (manual wallet credit)");
  const found = data(
    await call("GET", "/admin/users-search?q=0800000", null, aTok),
  );
  assert(
    (found ?? []).some((u) => u.id === usr.id),
    "patient found by phone fragment",
  );
  const foundByName = data(
    await call(
      `GET`,
      `/admin/users-search?q=${encodeURIComponent((usr.name || "").slice(0, 4))}`,
      null,
      aTok,
    ),
  );
  assert(
    (foundByName ?? []).some((u) => u.id === usr.id),
    "patient found by name fragment",
  );
  assert(
    (await call("GET", "/admin/users-search?q=0800000", null, dTok)).status ===
      403,
    "doctor blocked from finance search → 403",
  );

  const balBefore = (
    await prisma.userWallet.findUnique({ where: { userId: usr.id } })
  ).balance;
  assert(
    (
      await call(
        "POST",
        `/admin/users/${usr.id}/wallet-credit`,
        { amount: 0 },
        aTok,
      )
    ).status === 400,
    "zero amount → 400",
  );
  assert(
    (
      await call(
        "POST",
        `/admin/users/${usr.id}/wallet-credit`,
        { amount: 200_000_000 },
        aTok,
      )
    ).status === 400,
    "amount above ₦1,000,000 cap → 400",
  );
  assert(
    (
      await call(
        "POST",
        `/admin/users/unknown/wallet-credit`,
        { amount: 500000 },
        aTok,
      )
    ).status === 404,
    "unknown user → 404",
  );
  assert(
    (
      await call(
        "POST",
        `/admin/users/${usr.id}/wallet-credit`,
        { amount: 500000 },
        dTok,
      )
    ).status === 403,
    "doctor blocked → 403",
  );

  const credit = await call(
    "POST",
    `/admin/users/${usr.id}/wallet-credit`,
    { amount: 500000 },
    aTok,
  );
  const creditB = data(credit);
  txnRefs.push(creditB?.reference);
  assert(credit.status < 300, "₦5,000 credit accepted");
  const balAfter = (
    await prisma.userWallet.findUnique({ where: { userId: usr.id } })
  ).balance;
  assert(
    balAfter === balBefore + 500000 && creditB?.balance === balAfter,
    `wallet credited exactly ₦5,000 (${balBefore} → ${balAfter})`,
  );
  const hist = await prisma.userWalletHistory.findFirst({
    where: {
      walletId: wallet.id,
      type: "DEPOSIT",
      createdAt: { gte: testStart },
    },
    orderBy: { createdAt: "desc" },
  });
  assert(
    hist?.amount === 500000 &&
      hist?.description === "Wallet Top-up from Doctium Admin",
    'narration: "Wallet Top-up from Doctium Admin"',
  );
  const txn = await prisma.paymentTransaction.findUnique({
    where: { reference: creditB.reference },
  });
  assert(
    txn?.type === "WALLET_TOPUP" &&
      txn?.status === "SUCCESS" &&
      txn?.channel === "admin",
    "WALLET_TOPUP ledger row (shows on the Transactions page)",
  );
  const notif = await prisma.notification.findFirst({
    where: {
      userId: usr.id,
      type: "wallet_topup",
      createdAt: { gte: testStart },
    },
  });
  assert(
    !!notif && notif.title === "Your wallet has a new balance",
    'patient notified: "Your wallet has a new balance"',
  );
  const audit2 = await prisma.auditLog.findFirst({
    where: {
      action: "user.wallet-credit",
      entityId: usr.id,
      createdAt: { gte: testStart },
    },
  });
  assert(!!audit2, "wallet credit is audit-logged");

  // ── cleanup / restore ──
  if (docSub && docSub.status === "ACTIVE") {
    await prisma.subscription.update({
      where: { id: docSub.id },
      data: { status: "ACTIVE" },
    });
  }
  await call(
    "PATCH",
    `/admin/doctors/${doc.id}/commission`,
    { commission: doc.commission },
    aTok,
  );
  if (originalSetting) {
    await prisma.setting.update({
      where: { key: "admin_commission_percent" },
      data: { value: originalSetting.value },
    });
  }
  await prisma.paymentTransaction.deleteMany({
    where: { reference: { in: txnRefs.filter(Boolean) } },
  });
  await prisma.userWalletHistory.deleteMany({
    where: { walletId: wallet.id, createdAt: { gte: testStart } },
  });
  await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  await prisma.userWallet.update({
    where: { userId: usr.id },
    data: { balance: wallet.balance },
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
