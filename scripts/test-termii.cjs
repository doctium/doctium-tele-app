/**
 * Verifies the Termii API key WITHOUT sending an SMS (uses the balance endpoint,
 * so there's no cost). Run after adding TERMII_API_KEY to .env:
 *   node --env-file=.env scripts/test-termii.cjs
 */
const apiKey = process.env.TERMII_API_KEY;
const senderId = process.env.TERMII_SENDER_ID || "Doctium";

if (!apiKey) {
  console.error("❌ Missing TERMII_API_KEY in .env");
  process.exit(1);
}

(async () => {
  try {
    const res = await fetch(
      `https://api.ng.termii.com/api/get-balance?api_key=${encodeURIComponent(apiKey)}`,
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`❌ Termii rejected the key (HTTP ${res.status}):`, body);
      process.exit(1);
    }
    console.log("✅ Termii API key is valid");
    if (body.balance !== undefined)
      console.log(`   balance: ${body.balance} ${body.currency || ""}`.trim());
    console.log(`   sender ID configured as: "${senderId}"`);
    console.log(
      "   NOTE: the sender ID must be approved in the Termii dashboard, or live sends will fail.",
    );
  } catch (e) {
    console.error("❌ Termii check failed:", e.message || e);
    process.exit(1);
  }
})();
