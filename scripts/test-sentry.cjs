/**
 * Verifies a Sentry DSN actually accepts events (captures a test event + flushes).
 * Pass the DSN inline or via env:
 *   node scripts/test-sentry.cjs "https://...ingest.sentry.io/..."
 *   SENTRY_DSN=... node scripts/test-sentry.cjs
 */
const Sentry = require("@sentry/node");

const dsn = process.argv[2] || process.env.SENTRY_DSN;
if (!dsn) {
  console.error("❌ Provide a DSN: node scripts/test-sentry.cjs <dsn>");
  process.exit(1);
}

Sentry.init({ dsn, environment: "verification", tracesSampleRate: 0 });

(async () => {
  try {
    const id = Sentry.captureException(
      new Error("Doctium Sentry verification — safe to ignore/resolve"),
    );
    const delivered = await Sentry.flush(10000); // wait up to 10s for the send
    if (!delivered) throw new Error("flush timed out — event not delivered");
    console.log(`✅ Sentry accepted the event (id: ${id})`);
    console.log(
      "   Check the project's Issues tab for 'Doctium Sentry verification'.",
    );
  } catch (e) {
    console.error("❌ Sentry delivery failed:", e.message || e);
    console.error("   Double-check the DSN.");
    process.exit(1);
  }
})();
