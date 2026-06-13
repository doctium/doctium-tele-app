/**
 * Admin CSRF double-submit — verifies cookie-authenticated mutating requests
 * require a matching X-CSRF-Token header, while safe methods and non-cookie
 * (Bearer/webhook) requests are exempt.
 *
 * Run: node scripts/test-admin-csrf.cjs   (API up on :3001, admin seeded)
 */
const BASE = process.env.API_BASE || "http://localhost:3001/api/v1";
const ADMIN_COOKIE = "doctium_admin_token";
const CSRF_COOKIE = "doctium_csrf";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function getSetCookie(res) {
  return typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
}
function cookieValue(setCookies, name) {
  for (const c of setCookies) {
    const m = new RegExp(`(?:^|; )?${name}=([^;]*)`).exec(c || "");
    if (m && m[1]) return m[1];
  }
  return null;
}

async function login() {
  const res = await fetch(`${BASE}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@doctium.com", password: "admin123" }),
  });
  const sc = getSetCookie(res);
  return {
    session: cookieValue(sc, ADMIN_COOKIE),
    csrf: cookieValue(sc, CSRF_COOKIE),
  };
}

async function main() {
  const { session, csrf } = await login();
  assert(!!session && !!csrf, "login sets both session and CSRF cookies");

  const cookie = `${ADMIN_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`;

  // Safe method with cookie + no CSRF header → allowed.
  let r = await fetch(`${BASE}/admin/me`, { headers: { Cookie: cookie } });
  assert(r.status === 200, "GET (safe) with cookie needs no CSRF header");

  // Mutating with cookie + WRONG CSRF header → 403 (session not consumed).
  r = await fetch(`${BASE}/auth/admin/logout`, {
    method: "POST",
    headers: { Cookie: cookie, "X-CSRF-Token": "wrong-token" },
  });
  assert(r.status === 403, "mutating with wrong CSRF token is blocked (403)");

  // Mutating with cookie + NO CSRF header → 403.
  r = await fetch(`${BASE}/auth/admin/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert(r.status === 403, "mutating with missing CSRF token is blocked (403)");

  // Mutating with NO cookie → exempt (Bearer/webhook path) → allowed.
  r = await fetch(`${BASE}/auth/admin/logout`, { method: "POST" });
  assert(
    r.status === 200 || r.status === 201,
    "mutating without a session cookie is exempt (allowed)",
  );

  // Mutating with cookie + CORRECT CSRF header → allowed.
  r = await fetch(`${BASE}/auth/admin/logout`, {
    method: "POST",
    headers: { Cookie: cookie, "X-CSRF-Token": csrf },
  });
  assert(
    r.status === 200 || r.status === 201,
    "mutating with the matching CSRF token is allowed",
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} assertion(s) failed`);
  console.log("\n✅ Admin CSRF test passed");
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
