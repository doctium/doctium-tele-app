/**
 * Verifies the Africa's Talking credentials. By default it checks the account
 * (the /user balance endpoint — no cost). Pass a phone number to also send one
 * real test SMS to it.
 *
 *   node --env-file=.env scripts/test-africastalking.cjs
 *   node --env-file=.env scripts/test-africastalking.cjs +2348012345678
 *
 * Env: AT_API_KEY, AT_USERNAME ("sandbox" for the test env), optional
 * AT_SENDER_ID, AT_SANDBOX="true" to hit the sandbox endpoints.
 */
const apiKey = process.env.AT_API_KEY;
const username = process.env.AT_USERNAME;
const senderId = process.env.AT_SENDER_ID || "";
const sandbox = String(process.env.AT_SANDBOX || "").toLowerCase() === "true";
const to = process.argv[2]; // optional: send a real SMS to this number

if (!apiKey || !username) {
  console.error("❌ Missing AT_API_KEY or AT_USERNAME in .env");
  process.exit(1);
}

const base = sandbox
  ? "https://api.sandbox.africastalking.com"
  : "https://api.africastalking.com";

(async () => {
  // 1) Validate key + username via the account endpoint (no cost).
  try {
    const res = await fetch(
      `${base}/version1/user?username=${encodeURIComponent(username)}`,
      { headers: { apiKey, Accept: "application/json" } },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(
        `❌ Africa's Talking rejected the key (HTTP ${res.status}):`,
        body,
      );
      process.exit(1);
    }
    console.log(
      `✅ Africa's Talking credentials valid (${sandbox ? "SANDBOX" : "LIVE"})`,
    );
    if (body?.UserData?.balance)
      console.log(`   balance: ${body.UserData.balance}`);
    console.log(`   username: "${username}"`);
    console.log(
      `   sender ID: ${senderId ? `"${senderId}"` : "(none — default sender)"}`,
    );
  } catch (e) {
    console.error("❌ Account check failed:", e.message || e);
    process.exit(1);
  }

  if (!to) {
    console.log(
      "\nℹ️  No phone number given, so no SMS was sent (no cost). To send a real test:",
    );
    console.log(
      "   node --env-file=.env scripts/test-africastalking.cjs +234XXXXXXXXXX",
    );
    console.log(
      "   NOTE: live NG delivery needs an APPROVED sender ID + a funded balance.",
    );
    return;
  }

  // 2) Optional: send one real SMS.
  try {
    const form = new URLSearchParams();
    form.set("username", username);
    form.set("to", to);
    form.set("message", "Doctium test SMS via Africa's Talking ✅");
    if (senderId) form.set("from", senderId);
    const res = await fetch(`${base}/version1/messaging`, {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const body = await res.json().catch(() => ({}));
    const rcpt = body?.SMSMessageData?.Recipients?.[0];
    console.log(
      `\n→ send to ${to}: ${body?.SMSMessageData?.Message || `HTTP ${res.status}`}`,
    );
    if (rcpt) {
      console.log(
        `   status: ${rcpt.status} (code ${rcpt.statusCode}) · cost: ${rcpt.cost} · id: ${rcpt.messageId}`,
      );
      const ok =
        rcpt.status === "Success" || [100, 101, 102].includes(rcpt.statusCode);
      if (!ok) process.exit(1);
    } else {
      console.error(
        "   ❌ No recipient accepted — check sender ID / balance / number.",
      );
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ Send failed:", e.message || e);
    process.exit(1);
  }
})();
