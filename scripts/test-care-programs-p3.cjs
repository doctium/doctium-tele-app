// Live verification of Care Programs Phase 3 (enterprise layer):
//  - org CRUD + member attach (by email/mobile) + permission gates
//  - sponsored enrollment: org covers paid programs (wallet untouched),
//    seat limits enforced, withdrawal frees the seat, suspension stops coverage
//  - utilization + outcomes (admin org detail) and the CSV report download
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

const PRICE = 500_000;
const state = {
  enrollmentIds: [],
  orgId: null,
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
  if (state.orgId)
    await prisma.organization.deleteMany({ where: { id: state.orgId } });
  if (state.tmpSubPatientId)
    await prisma.subPatient.deleteMany({
      where: { id: state.tmpSubPatientId },
    });
  if (state.tmpProgramId)
    await prisma.careProgram.deleteMany({ where: { id: state.tmpProgramId } });
  if (state.walletId && state.originalBalance != null)
    await prisma.userWallet.update({
      where: { id: state.walletId },
      data: { balance: state.originalBalance },
    });
};

(async () => {
  const usr = await prisma.user.findFirst({
    where: { mobile: "08000000002" },
    select: { id: true, name: true, mobile: true },
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

  // clean slate
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
  await prisma.organization.deleteMany({ where: { name: "Acme HMO (test)" } });

  const paidProgram = await prisma.careProgram.create({
    data: {
      code: "test_p3_prog",
      name: "Sponsored BP Care",
      price: PRICE,
      vitals: [{ type: "WEIGHT", cadencePerWeek: 1 }],
    },
  });
  state.tmpProgramId = paidProgram.id;
  const member = await prisma.subPatient.create({
    data: { userId: usr.id, name: "P3 Junior", relation: "Child", age: 7 },
  });
  state.tmpSubPatientId = member.id;
  const wallet = await prisma.userWallet.upsert({
    where: { userId: usr.id },
    create: { userId: usr.id, balance: 0 },
    update: {},
  });
  state.walletId = wallet.id;
  state.originalBalance = wallet.balance;
  await prisma.userWallet.update({
    where: { id: wallet.id },
    data: { balance: 0 },
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

  // ── 1) org CRUD + gates ──
  console.log("\n1) Organizations");
  assert(
    (await call("GET", "/admin/organizations", null, dTok)).status === 403,
    "doctor blocked from organizations → 403",
  );
  const org = data(
    await call(
      "POST",
      "/admin/organizations",
      { name: "Acme HMO (test)", type: "HMO", contactEmail: "ops@acme.test" },
      aTok,
    ),
  );
  state.orgId = org?.id;
  assert(!!org?.id && org.status === "ACTIVE", "org created (ACTIVE)");
  const list = data(await call("GET", "/admin/organizations", null, aTok));
  assert(
    (list ?? []).some(
      (o) => o.id === org.id && typeof o.memberCount === "number",
    ),
    "org list carries member/sponsorship counts",
  );

  // ── 2) members ──
  console.log("\n2) Members");
  const added = await call(
    "POST",
    `/admin/organizations/${org.id}/members`,
    { identifier: usr.mobile, externalRef: "EMP-001" },
    aTok,
  );
  assert(
    added.status < 300 && data(added)?.user?.id === usr.id,
    "member attached by mobile, resolves the account",
  );
  assert(
    (
      await call(
        "POST",
        `/admin/organizations/${org.id}/members`,
        { identifier: usr.mobile },
        aTok,
      )
    ).status === 400,
    "duplicate member → 400",
  );
  assert(
    (
      await call(
        "POST",
        `/admin/organizations/${org.id}/members`,
        { identifier: "no-such-user@nowhere.test" },
        aTok,
      )
    ).status === 404,
    "unknown identifier → 404",
  );

  // ── 3) sponsorship + sponsored enrollment ──
  console.log("\n3) Sponsored enrollment");
  const spons = data(
    await call(
      "POST",
      `/admin/organizations/${org.id}/sponsorships`,
      { programId: paidProgram.id, seats: 1 },
      aTok,
    ),
  );
  assert(spons?.seats === 1 && spons?.isActive, "sponsorship created (1 seat)");

  const cat = data(await call("GET", "/care-programs", null, pTok));
  assert(
    (cat.sponsoredPrograms ?? []).some(
      (s) => s.programId === paidProgram.id && s.orgName === "Acme HMO (test)",
    ),
    "catalog marks the program as sponsored for this member",
  );

  const en = await call(
    "POST",
    `/care-programs/${paidProgram.id}/enroll`,
    { doctorId: doc.id },
    pTok,
  );
  const enB = data(en);
  if (enB?.id) state.enrollmentIds.push(enB.id);
  assert(
    en.status < 300 && enB?.sponsorshipId === spons.id,
    "₦5,000 program enrolls FREE via sponsorship (wallet at ₦0)",
  );
  assert(
    enB?.paidAmount === 0 &&
      enB?.sponsorship?.organization?.name === "Acme HMO (test)",
    "no charge recorded; response names the sponsor",
  );
  const balance = (
    await prisma.userWallet.findUnique({ where: { id: wallet.id } })
  ).balance;
  assert(balance === 0, "wallet untouched");

  // ── 4) seat limits ──
  console.log("\n4) Seat limits");
  const famFail = await call(
    "POST",
    `/care-programs/${paidProgram.id}/enroll`,
    { subPatientId: member.id },
    pTok,
  );
  assert(
    famFail.status === 400 &&
      JSON.stringify(famFail.body).toLowerCase().includes("insufficient"),
    "seats exhausted → falls back to wallet → 400 (no free ride)",
  );
  await call(
    "POST",
    `/admin/organizations/${org.id}/sponsorships`,
    { programId: paidProgram.id, seats: 2 },
    aTok,
  );
  const fam = await call(
    "POST",
    `/care-programs/${paidProgram.id}/enroll`,
    { subPatientId: member.id },
    pTok,
  );
  const famB = data(fam);
  if (famB?.id) state.enrollmentIds.push(famB.id);
  assert(
    fam.status < 300 &&
      famB?.sponsorshipId === spons.id &&
      famB?.subPatientId === member.id,
    "seats raised to 2 → family member also covered",
  );

  // ── 5) utilization + outcomes detail ──
  console.log("\n5) Utilization & outcomes");
  const detail = data(
    await call("GET", `/admin/organizations/${org.id}`, null, aTok),
  );
  assert(detail?.summary?.members === 1, "detail: 1 member");
  assert(
    detail?.sponsorships?.[0]?.seatsUsed === 2,
    `detail: 2 of ${detail?.sponsorships?.[0]?.seats} seats used`,
  );
  assert(
    (detail?.enrollments ?? []).some((r) => r.member === "P3 Junior") &&
      (detail?.enrollments ?? []).some((r) => r.member === usr.name),
    "outcome rows list both the member and the account holder",
  );

  // CSV report (raw fetch — bypasses the JSON envelope)
  const csvRes = await fetch(
    `${BASE}/admin/organizations/${org.id}/report.csv`,
    {
      headers: { authorization: `Bearer ${aTok}` },
    },
  );
  const csv = await csvRes.text();
  assert(
    csvRes.status === 200 &&
      (csvRes.headers.get("content-type") ?? "").includes("text/csv"),
    "CSV report downloads with text/csv",
  );
  assert(
    csv.startsWith("Member,Account,Program") && csv.includes("P3 Junior"),
    "CSV carries the header row + member rows",
  );

  // ── 6) seat freed on withdrawal ──
  console.log("\n6) Seats & lifecycle");
  await call(
    "POST",
    `/care-programs/enrollments/${famB.id}/withdraw`,
    {},
    pTok,
  );
  const detail2 = data(
    await call("GET", `/admin/organizations/${org.id}`, null, aTok),
  );
  assert(
    detail2?.sponsorships?.[0]?.seatsUsed === 1,
    "withdrawal frees the seat (2 → 1 used)",
  );

  // suspension stops new sponsored enrollment
  await call(
    "PATCH",
    `/admin/organizations/${org.id}`,
    { status: "SUSPENDED" },
    aTok,
  );
  const cat2 = data(await call("GET", "/care-programs", null, pTok));
  assert(
    !(cat2.sponsoredPrograms ?? []).some((s) => s.programId === paidProgram.id),
    "suspended org → program no longer marked sponsored",
  );
  const afterSuspend = await call(
    "POST",
    `/care-programs/${paidProgram.id}/enroll`,
    { subPatientId: member.id },
    pTok,
  );
  assert(
    afterSuspend.status === 400,
    "suspended org → enrollment falls back to wallet → 400",
  );

  // free program never accidentally linked (org doesn't sponsor it)
  const free = await call(
    "POST",
    `/care-programs/${freeProgram.id}/enroll`,
    { doctorId: doc.id },
    pTok,
  );
  const freeB = data(free);
  if (freeB?.id) state.enrollmentIds.push(freeB.id);
  assert(
    free.status < 300 && freeB?.sponsorshipId == null,
    "unsponsored free program enrolls without a sponsorship link",
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
