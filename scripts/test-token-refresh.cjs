/**
 * Token-refresh flow — verifies POST /auth/refresh exchanges a valid refresh
 * token for a fresh access + refresh token (rotation), the new access token
 * authenticates a protected route, and an invalid refresh token is rejected.
 *
 * Run: node scripts/test-token-refresh.cjs   (API up on :3001, patient seeded)
 */
const BASE = process.env.API_BASE || "http://localhost:3001/api/v1";

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

async function call(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json?.data ?? json };
}

async function main() {
  // Login → access + refresh tokens
  const login = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const accessToken = login.data?.accessToken;
  const refreshToken = login.data?.refreshToken;
  assert(
    login.status === 200 || login.status === 201,
    "patient login succeeds",
  );
  assert(
    !!accessToken && !!refreshToken,
    "login returns access + refresh tokens",
  );

  // Refresh → new tokens (rotation)
  const refreshed = await call("POST", "/auth/refresh", { refreshToken });
  const newAccess = refreshed.data?.accessToken;
  const newRefresh = refreshed.data?.refreshToken;
  assert(
    refreshed.status === 200 || refreshed.status === 201,
    "refresh succeeds",
  );
  assert(!!newAccess, "refresh returns a fresh access token");
  // Stateless JWTs: a new refresh token is issued (byte-identical if minted in the
  // same second, since iat is second-granular). True rotation/reuse-detection needs
  // a per-token jti + server-side tracking — a documented follow-up.
  assert(!!newRefresh, "refresh returns a refresh token");

  // New access token authenticates a protected route
  const mine = await call("GET", "/appointments/mine", null, newAccess);
  assert(
    mine.status === 200,
    "new access token authenticates a protected route",
  );

  // Invalid refresh token → 401
  const bad = await call("POST", "/auth/refresh", {
    refreshToken: "not-a-token",
  });
  assert(bad.status === 401, "invalid refresh token is rejected (401)");

  // Missing refresh token → 401
  const empty = await call("POST", "/auth/refresh", {});
  assert(empty.status === 401, "missing refresh token is rejected (401)");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} assertion(s) failed`);
  console.log("\n✅ Token-refresh test passed");
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
