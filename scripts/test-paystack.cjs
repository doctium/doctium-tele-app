/**
 * Verifies the Paystack secret key with a read-only call (GET /balance — no
 * charge, nothing created). Run after adding PAYSTACK_* to .env:
 *   node --env-file=.env scripts/test-paystack.cjs
 */
const secret = process.env.PAYSTACK_SECRET_KEY;
const pub = process.env.PAYSTACK_PUBLIC_KEY;

if (!secret) {
  console.error("❌ Missing PAYSTACK_SECRET_KEY in .env");
  process.exit(1);
}

const mode = secret.startsWith("sk_live_")
  ? "LIVE"
  : secret.startsWith("sk_test_")
    ? "TEST"
    : "UNKNOWN";

(async () => {
  try {
    const res = await fetch("https://api.paystack.co/balance", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.status) {
      console.error(
        `❌ Paystack rejected the secret key (HTTP ${res.status}):`,
        body.message || body,
      );
      process.exit(1);
    }
    console.log(`✅ Paystack secret key is valid (${mode} mode)`);
    for (const b of body.data || [])
      console.log(
        `   balance: ${(b.balance / 100).toLocaleString()} ${b.currency}`,
      );
    if (!pub)
      console.log(
        "   ⚠️  PAYSTACK_PUBLIC_KEY is not set (needed by the app for card checkout).",
      );
    else if (!pub.startsWith("pk_"))
      console.log(
        "   ⚠️  PAYSTACK_PUBLIC_KEY doesn't start with pk_ — double-check it.",
      );
    else if (mode === "LIVE" && !pub.startsWith("pk_live_"))
      console.log(
        "   ⚠️  Secret is LIVE but public key isn't pk_live_ — mismatch.",
      );
    else console.log(`   public key: ${pub.slice(0, 12)}… (ok)`);
  } catch (e) {
    console.error("❌ Paystack check failed:", e.message || e);
    process.exit(1);
  }
})();
