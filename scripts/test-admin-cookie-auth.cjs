/**
 * Admin httpOnly-cookie auth — safety net for the localStorage → cookie migration.
 * Verifies the admin session works via the httpOnly cookie AND that the
 * Authorization: Bearer path still works (mobile apps / programmatic clients).
 *
 * Run: node scripts/test-admin-cookie-auth.cjs   (API up on :3001, admin seeded)
 */
const BASE = process.env.API_BASE || "http://localhost:3001/api/v1";
const COOKIE = "doctium_admin_token";

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
  const all =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean);
  return all;
}
function cookieValue(setCookies, name) {
  for (const c of setCookies) {
    const m = new RegExp(`(?:^|; )?${name}=([^;]*)`).exec(c || "");
    if (m) return { raw: c, value: m[1] };
  }
  return null;
}

async function main() {
  // ── Login sets an httpOnly cookie ────────────────────────
  const loginRes = await fetch(`${BASE}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@doctium.com", password: "admin123" }),
  });
  const loginBody = await loginRes.json();
  const bearer = loginBody?.data?.accessToken;
  const setCookies = getSetCookie(loginRes);
  const cookie = cookieValue(setCookies, COOKIE);

  assert(
    loginRes.status === 200 || loginRes.status === 201,
    "admin login succeeds",
  );
  assert(!!cookie, "login response sets the session cookie");
  assert(
    !!cookie && /HttpOnly/i.test(cookie.raw),
    "session cookie is HttpOnly",
  );
  assert(
    !!cookie && /SameSite=Lax/i.test(cookie.raw),
    "session cookie is SameSite=Lax",
  );
  assert(
    !!bearer,
    "login still returns a bearer token in the body (mobile/programmatic)",
  );

  const cookieHeader = `${COOKIE}=${cookie ? cookie.value : ""}`;

  // ── /admin/me via cookie only (no Authorization header) ──
  let r = await fetch(`${BASE}/admin/me`, {
    headers: { Cookie: cookieHeader },
  });
  let body = await r.json();
  assert(r.status === 200, "GET /admin/me authenticates via the cookie alone");
  assert(
    body?.data?.email === "admin@doctium.com",
    "cookie session returns the admin identity",
  );

  // ── /admin/me with no auth → 401 ─────────────────────────
  r = await fetch(`${BASE}/admin/me`);
  assert(r.status === 401, "GET /admin/me with no auth is rejected (401)");

  // ── Bearer header still works (mobile / regression) ──────
  r = await fetch(`${BASE}/admin/me`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  assert(
    r.status === 200,
    "GET /admin/me still works via Authorization: Bearer",
  );

  // ── Logout clears the cookie ─────────────────────────────
  r = await fetch(`${BASE}/auth/admin/logout`, {
    method: "POST",
    headers: { Cookie: cookieHeader },
  });
  const cleared = cookieValue(getSetCookie(r), COOKIE);
  assert(r.status === 200 || r.status === 201, "logout succeeds");
  assert(
    !!cleared &&
      (/Expires=Thu, 01 Jan 1970/i.test(cleared.raw) ||
        /Max-Age=0/i.test(cleared.raw)),
    "logout sends a cookie-clearing Set-Cookie",
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} assertion(s) failed`);
  console.log("\n✅ Admin cookie-auth test passed");
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
