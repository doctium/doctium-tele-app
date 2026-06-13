import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  transpilePackages: [
    "@doctium/brand",
    "@doctium/types",
    "@doctium/validation",
  ],
  // v15: experimental features available in stable
  serverExternalPackages: [],
};

// Sentry build wrapper. Runtime error capture works via the DSN; source-map
// upload (for readable stack traces) only runs when SENTRY_AUTH_TOKEN/org/project
// are set, so local/CI builds without them still succeed.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  disableLogger: true,
});
