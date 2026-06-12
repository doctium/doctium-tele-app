// Live verification of Care Programs Phase 2.5:
//  - family-member enrollment: ownership check, per-member duplicate gate,
//    self + member in the same program, member threading into readings/cohort
//  - paid programs: atomic wallet charge (exact debit, no overdraft, no double
//    charge), UserWalletHistory + PaymentTransaction ledger rows, paymentRef audit
// Run AFTER scripts/seed-care-programs.cjs.
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

const PRICE = 500_000; // ₦5,000 in kobo
const state = {
  enrollmentIds: [],
  tmpProgramId: null,
  tmpSubPatientId: null,
  walletId: null,
  originalBalance: null,
};

const cleanup = async () => {
  if (state.enrollmentIds.length) {
    await prisma.programGoal.deleteMany({
      where: { enrollmentId: { in: state.enrollmentIds } },
    });
    await prisma.vitalAlert.deleteMany({
      where: { enrollmentId: { in: state.enrollmentIds } },
    });
    await prisma.vitalReading.deleteMany({
      where: { enrollmentId: { in: state.enrollmentIds } },
    });
    await prisma.programEnrollment.deleteMany({
      where: { id: { in: state.enrollmentIds } },
    });
  }
  if (state.walletId) {
    await prisma.userWalletHistory.deleteMany({
      where: { walletId: state.walletId, type: "CARE_PROGRAM_PAYMENT" },
    });
    if (state.originalBalance != null)
      await prisma.userWallet.update({
        where: { id: state.walletId },
        data: { balance: state.originalBalance },
      });
  }
  await prisma.paymentTransaction.deleteMany({
    where: { type: "CARE_PROGRAM_PAYMENT" },
  });
  if (state.tmpSubPatientId)
    await prisma.subPatient.deleteMany({
      where: { id: state.tmpSubPatientId },
    });
  if (state.tmpProgramId)
    await prisma.careProgram.deleteMany({ where: { id: state.tmpProgramId } });
};

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, name: true },
  });
  const doc = await prisma.doctor.findFirst({
    where: { email: "rxdoc@doctium.com" },
    select: { id: true },
  });
  const freeProgram = await prisma.careProgram.findUnique({
    where: { code: "hypertension" },
  });
  if (!usr || !doc) throw new Error("seed patient/doctor missing");
  if (!freeProgram) throw new Error("run scripts/seed-care-programs.cjs first");

  // clean slate from earlier runs
  const old = await prisma.programEnrollment.findMany({
    where: { userId: usr.id },
    select: { id: true },
  });
  for (const e of old) {
    await prisma.programGoal.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.vitalAlert.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.vitalReading.deleteMany({ where: { enrollmentId: e.id } });
    await prisma.programEnrollment.delete({ where: { id: e.id } });
  }

  // fixtures: a family member, a paid program, a known wallet balance
  const member = await prisma.subPatient.create({
    data: { userId: usr.id, name: "Test Junior", relation: "Child", age: 9 },
  });
  state.tmpSubPatientId = member.id;
  const paidProgram = await prisma.careProgram.create({
    data: {
      code: "test_paid_prog",
      name: "Premium BP Care",
      price: PRICE,
      vitals: [{ type: "WEIGHT", cadencePerWeek: 1 }],
    },
  });
  state.tmpProgramId = paidProgram.id;
  const wallet = await prisma.userWallet.upsert({
    where: { userId: usr.id },
    create: { userId: usr.id, balance: 0 },
    update: {},
  });
  state.walletId = wallet.id;
  state.originalBalance = wallet.balance;

  const pl = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const dl = await call("POST", "/auth/doctor/login", {
    email: "rxdoc@doctium.com",
    password: "test1234",
  });
  const pTok = data(pl)?.accessToken;
  const dTok = data(dl)?.accessToken;
  console.log("logins:", pl.status, dl.status);
  if (!pTok || !dTok) throw new Error("login failed");

  // ── 1) family-member enrollment ──
  console.log("\n1) Family-member enrollment");
  const self = await call(
    "POST",
    `/care-programs/${freeProgram.id}/enroll`,
    { doctorId: doc.id },
    pTok,
  );
  if (data(self)?.id) state.enrollmentIds.push(data(self).id);
  assert(self.status < 300, "self enrolls in hypertension");

  const fam = await call(
    "POST",
    `/care-programs/${freeProgram.id}/enroll`,
    { doctorId: doc.id, subPatientId: member.id },
    pTok,
  );
  const famB = data(fam);
  if (famB?.id) state.enrollmentIds.push(famB.id);
  assert(
    fam.status < 300 && famB?.subPatientId === member.id,
    "family member joins the SAME program independently",
  );
  assert(
    famB?.subPatient?.name === "Test Junior",
    "response carries the member's name",
  );

  const famDup = await call(
    "POST",
    `/care-programs/${freeProgram.id}/enroll`,
    { subPatientId: member.id },
    pTok,
  );
  assert(
    famDup.status === 400 &&
      JSON.stringify(famDup.body).includes("Test Junior"),
    "duplicate member enrollment blocked, names the member",
  );
  assert(
    (
      await call(
        "POST",
        `/care-programs/${freeProgram.id}/enroll`,
        { subPatientId: "not_my_member_id" },
        pTok,
      )
    ).status === 404,
    "foreign/unknown family member → 404",
  );

  const read = await call(
    "POST",
    `/care-programs/enrollments/${famB.id}/readings`,
    { type: "BLOOD_PRESSURE", value: 120, value2: 80 },
    pTok,
  );
  assert(
    data(read)?.reading?.subPatientId === member.id,
    "member's readings carry subPatientId (EMR-consistent)",
  );

  const mine = data(await call("GET", "/care-programs/mine", null, pTok));
  const mineFam = (mine.enrollments ?? []).find((e) => e.id === famB.id);
  assert(
    mineFam?.subPatient?.name === "Test Junior" &&
      (mine.enrollments ?? []).some((e) => e.id === data(self).id),
    "hub lists self + member enrollments, member labelled",
  );
  const catalog = data(await call("GET", "/care-programs", null, pTok));
  assert(
    (catalog.enrolledProgramIds ?? []).includes(freeProgram.id),
    "enrolledProgramIds reflects self-enrollment",
  );

  const cohort = data(
    await call("GET", "/care-programs/doctor/cohort", null, dTok),
  );
  const famRow = (cohort.cohort ?? []).find((c) => c.id === famB.id);
  assert(
    famRow?.subPatient?.name === "Test Junior" && famRow?.user?.name,
    "doctor cohort shows the member with the account holder",
  );

  // ── 2) paid programs: insufficient balance ──
  console.log("\n2) Paid enrollment — insufficient balance");
  await prisma.userWallet.update({
    where: { id: wallet.id },
    data: { balance: PRICE - 100_000 },
  });
  const poor = await call(
    "POST",
    `/care-programs/${paidProgram.id}/enroll`,
    {},
    pTok,
  );
  assert(
    poor.status === 400 &&
      JSON.stringify(poor.body).toLowerCase().includes("insufficient"),
    "insufficient balance → 400 with top-up message",
  );
  const balAfterFail = (
    await prisma.userWallet.findUnique({ where: { id: wallet.id } })
  ).balance;
  assert(
    balAfterFail === PRICE - 100_000,
    "wallet untouched on failed enrollment",
  );
  assert(
    (await prisma.programEnrollment.count({
      where: { userId: usr.id, programId: paidProgram.id },
    })) === 0,
    "no enrollment row created",
  );

  // ── 3) paid programs: happy path ──
  console.log("\n3) Paid enrollment — wallet charge");
  await prisma.userWallet.update({
    where: { id: wallet.id },
    data: { balance: 1_000_000 },
  });
  const paid = await call(
    "POST",
    `/care-programs/${paidProgram.id}/enroll`,
    {},
    pTok,
  );
  const paidB = data(paid);
  if (paidB?.id) state.enrollmentIds.push(paidB.id);
  assert(paid.status < 300, "enrollment succeeds with sufficient balance");
  assert(
    paidB?.paidAmount === PRICE && !!paidB?.paymentRef,
    "enrollment records paidAmount + paymentRef",
  );
  const balAfter = (
    await prisma.userWallet.findUnique({ where: { id: wallet.id } })
  ).balance;
  assert(
    balAfter === 1_000_000 - PRICE,
    `wallet debited exactly ₦5,000 (${balAfter} kobo left)`,
  );
  const hist = await prisma.userWalletHistory.findFirst({
    where: { walletId: wallet.id, type: "CARE_PROGRAM_PAYMENT" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    hist?.amount === PRICE && hist?.description.includes("Premium BP Care"),
    "wallet history row written (CARE_PROGRAM_PAYMENT)",
  );
  const txn = await prisma.paymentTransaction.findUnique({
    where: { reference: paidB.paymentRef },
  });
  assert(
    txn?.type === "CARE_PROGRAM_PAYMENT" &&
      txn?.status === "SUCCESS" &&
      txn?.provider === "WALLET" &&
      txn?.amount === PRICE,
    "PaymentTransaction ledger row matches (admin Transactions page will show it)",
  );

  // double-charge guard: re-enroll while active
  const dup = await call(
    "POST",
    `/care-programs/${paidProgram.id}/enroll`,
    {},
    pTok,
  );
  assert(dup.status === 400, "re-enrollment blocked → 400");
  const balAfterDup = (
    await prisma.userWallet.findUnique({ where: { id: wallet.id } })
  ).balance;
  assert(
    balAfterDup === 1_000_000 - PRICE,
    "no double charge on blocked re-enrollment",
  );

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  try {
    await cleanup();
  } catch {}
  await prisma.$disconnect();
  process.exit(1);
});
