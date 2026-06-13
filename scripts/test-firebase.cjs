/**
 * Verifies Firebase service-account credentials (FCM). Confirms the key actually
 * authenticates with Google — not just that the env vars are present.
 * Run AFTER adding FIREBASE_* to .env:
 *   node --env-file=.env scripts/test-firebase.cjs
 */
const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "❌ Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env",
  );
  process.exit(1);
}
privateKey = privateKey.replace(/\\n/g, "\n"); // .env stores escaped newlines

if (!privateKey.includes("BEGIN PRIVATE KEY")) {
  console.error(
    "❌ FIREBASE_PRIVATE_KEY doesn't look like a PEM key — check it's the JSON 'private_key' value, quoted, with \\n.",
  );
  process.exit(1);
}

(async () => {
  try {
    const cred = admin.credential.cert({ projectId, clientEmail, privateKey });
    const token = await cred.getAccessToken(); // round-trips to Google's OAuth endpoint
    if (!token || !token.access_token)
      throw new Error("no access token returned");
    console.log("✅ Firebase service account authenticated");
    console.log("   project:", projectId);
    console.log("   client: ", clientEmail);
    console.log("✅ FCM push sending is ready (server side).");
  } catch (e) {
    console.error("❌ Firebase auth failed:", e.message || e);
    console.error(
      "   Common cause: the private key wasn't pasted as a single quoted line with \\n.",
    );
    process.exit(1);
  }
})();
