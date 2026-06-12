/**
 * E2E smoke for patient email verification (run with the dev API up):
 *   node --env-file=.env scripts/test-email-verification.cjs
 * 1) register w/ email → OTP + link rows created
 * 2) verify by 6-digit code → users.emailVerified
 * 3) second user verifies via the emailed LINK → branded HTML page
 * 4) bad token → invalid/expired page
 */
const { PrismaClient } = require("@prisma/client");

(async () => {
  const db = new PrismaClient();
  const base = "http://localhost:3001/api/v1";
  const stamp = Date.now();
  let pass = 0;
  let fail = 0;
  const check = (name, ok) => {
    console.log(`${ok ? "✓" : "✗"} ${name}`);
    ok ? pass++ : fail++;
  };

  // 1) Register with email
  const em1 = `verify1.${stamp}@test.com`;
  const reg = await fetch(`${base}/auth/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Verify Test",
      mobile: "080" + String(stamp).slice(-8),
      email: em1,
      password: "test1234",
    }),
  }).then((r) => r.json());
  check("register returns tokens", !!reg.data?.accessToken);

  await new Promise((r) => setTimeout(r, 800)); // fire-and-forget send settles
  const rows = await db.otp.findMany({ where: { email: em1 } });
  const code = rows.find((r) => /^\d{6}$/.test(r.otp))?.otp;
  const token = rows.find((r) => r.otp.startsWith("evl_"))?.otp;
  check("6-digit code row created", !!code);
  check("link token row created", !!token);

  // 2) Verify by code
  const v = await fetch(`${base}/auth/email-verification/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: em1, code }),
  }).then((r) => r.json());
  check("verify-by-code returns verified", v.data?.verified === true);
  const u1 = await db.user.findFirst({
    where: { email: em1 },
    select: { emailVerified: true },
  });
  check("db emailVerified=true (code path)", u1?.emailVerified === true);
  const leftover = await db.otp.count({ where: { email: em1 } });
  check("otp rows cleaned up", leftover === 0);

  // 3) Second user → verify via LINK
  const em2 = `verify2.${stamp}@test.com`;
  await fetch(`${base}/auth/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Verify Link",
      mobile: "081" + String(stamp).slice(-8),
      email: em2,
      password: "test1234",
    }),
  }).then((r) => r.json());
  await new Promise((r) => setTimeout(r, 800));
  const rows2 = await db.otp.findMany({ where: { email: em2 } });
  const token2 = rows2.find((r) => r.otp.startsWith("evl_"))?.otp;
  const html = await fetch(`${base}/auth/verify-email?token=${token2}`).then(
    (r) => r.text(),
  );
  check(
    "link path renders 'Email verified successfully' page",
    html.includes("Email verified successfully"),
  );
  const u2 = await db.user.findFirst({
    where: { email: em2 },
    select: { emailVerified: true },
  });
  check("db emailVerified=true (link path)", u2?.emailVerified === true);

  // 4) Bad token → failure page
  const bad = await fetch(`${base}/auth/verify-email?token=evl_nope`).then(
    (r) => r.text(),
  );
  check("bad token renders invalid/expired page", bad.includes("Link invalid"));

  // Cleanup test users
  await db.user.deleteMany({ where: { email: { in: [em1, em2] } } });

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
