import * as Sentry from "@sentry/nestjs";

// Initialised only when SENTRY_DSN is set — a no-op in dev / without Sentry.
// MUST be imported before anything else in main.ts so the SDK can instrument
// modules as they load.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    // Sample performance traces (tune down in prod to control cost/volume).
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Don't ship PII (emails, IPs) to Sentry by default — this is a health app.
    sendDefaultPii: false,
  });
}
