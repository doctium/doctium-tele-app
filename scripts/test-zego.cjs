/**
 * Verifies Zego is configured server-side: logs in, requests a call token, and
 * confirms the API returns a Token04 + the AppID (i.e. ZEGO_APP_ID +
 * ZEGO_SERVER_SECRET are set and valid). Live video needs a native dev build.
 *
 * Run (API up on :3001, patient seeded):
 *   node scripts/test-zego.cjs
 */
const BASE = process.env.API_BASE || "http://localhost:3001/api/v1";

let passed = 0;
let failed = 0;
function assert(c, label) {
  if (c) {
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
  const login = await call("POST", "/auth/user/login", {
    mobile: "08000000002",
    password: "test1234",
  });
  const token = login.data?.accessToken;
  assert(!!token, "patient login succeeds");

  const r = await call("POST", "/call/token", null, token);
  if (r.status >= 400) {
    console.error("   token endpoint error:", JSON.stringify(r.data));
  }
  assert(r.status === 200 || r.status === 201, "POST /call/token succeeds");
  assert(
    typeof r.data?.token === "string" && r.data.token.length > 20,
    "returns a Zego Token04",
  );
  assert(
    Number.isInteger(r.data?.appId) && r.data.appId > 0,
    "returns the numeric Zego AppID",
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} assertion(s) failed`);
  console.log(
    `\n✅ Zego server-side token issuance works (AppID ${r.data.appId}).`,
  );
  console.log(
    "   Live video requires a native dev/production build (not Expo Go).",
  );
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
