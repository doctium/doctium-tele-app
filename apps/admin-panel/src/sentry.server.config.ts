import * as Sentry from "@sentry/nextjs";

// No-ops when NEXT_PUBLIC_SENTRY_DSN is unset (Sentry.init with an empty DSN is disabled).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  sendDefaultPii: false,
});
