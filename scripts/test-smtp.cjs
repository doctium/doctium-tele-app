/**
 * Verifies SMTP connection + auth (transporter.verify — no email sent), and
 * optionally sends a real test email if you pass a recipient.
 *   node --env-file=.env scripts/test-smtp.cjs                 # connect + auth only
 *   node --env-file=.env scripts/test-smtp.cjs you@example.com # also send a test
 */
const nodemailer = require("nodemailer");

const host = process.env.SMTP_HOST;
if (!host) {
  console.error("❌ Missing SMTP_HOST in .env");
  process.exit(1);
}
const port = parseInt(process.env.SMTP_PORT || "587", 10);
const from =
  process.env.SMTP_FROM ||
  process.env.SMTP_USER ||
  "no-reply@doctiumhealth.com";

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

(async () => {
  try {
    await transporter.verify();
    console.log(`✅ SMTP connection + auth OK (${host}:${port}, from ${from})`);

    const to = process.argv[2];
    if (to) {
      const info = await transporter.sendMail({
        from,
        to,
        subject: "Doctium SMTP test",
        html: "<p>✅ Doctium SMTP is working.</p>",
      });
      console.log(`✅ Test email sent to ${to} (id: ${info.messageId})`);
      console.log(
        "   Check the inbox AND spam folder to confirm deliverability.",
      );
    } else {
      console.log(
        "   (pass a recipient address to also send a live test email)",
      );
    }
  } catch (e) {
    console.error("❌ SMTP check failed:", e.message || e);
    console.error(
      "   Verify SMTP_HOST/PORT/USER/PASS and that the domain is verified with the provider.",
    );
    process.exit(1);
  }
})();
