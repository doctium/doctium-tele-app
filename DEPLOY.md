# Doctium — Production Deployment (Tier A)

Cheapest/fastest stack, EU region (NDPA-defensible with a DPA + patient consent;
migrate to in-Nigeria later if required — Prisma makes it a connection-string change).

```
Patients/Doctors (mobile, EAS build) ─┐
                                       ├─► api.doctiumhealth.com  (NestJS on Railway, EU)
Admins (browser) ─ dashboard.doctiumhealth.com (Next.js on Vercel) ─┘        │
                                                                            ▼
                                                          Postgres on Neon (EU / Frankfurt)
DNS for all of it: Cloudflare (doctiumhealth.com)
```

Architecture decisions: Railway runs the API (long-running + WebSockets + cron — not
serverless). Vercel runs the admin (Next.js). Neon is managed Postgres (auto backups

- PITR). All EU-region to keep latency to Nigeria low and data co-located.

---

## 0. Generate production secrets (run locally; never commit / never paste in chat)

```bash
# Strong JWT secrets
node -e "console.log('JWT_SECRET='+require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('JWT_REFRESH_SECRET='+require('crypto').randomBytes(48).toString('base64url'))"

# Fresh PRODUCTION prescription signing key (separate from dev). Prints an env-ready line.
node -e "const c=require('crypto');const{privateKey}=c.generateKeyPairSync('ed25519',{privateKeyEncoding:{type:'pkcs8',format:'pem'}});console.log('RX_PRIVATE_KEY=\"'+privateKey.replace(/\r?\n/g,'\\n')+'\"')"
```

Keep these in your password manager. They go into Railway's variables (step 2), not git.

---

## 1. Neon (database)

1. Create a Neon project → region **EU (Frankfurt)** → database `doctium`.
2. Copy the **direct** connection string (the one **without** `-pooler` in the host).
   The API is a single long-running server, so it doesn't need pooled connections,
   and Prisma migrations require the direct connection. It looks like:
   `postgresql://USER:PASS@ep-xxxx.eu-central-1.aws.neon.tech/doctium?sslmode=require`
3. You'll paste this as `DATABASE_URL` in Railway (step 2). Don't run anything yet —
   Railway runs the migration automatically on first deploy.

---

## 2. Railway (API → api.doctiumhealth.com)

1. New Project → **Deploy from GitHub repo** → authorize → pick `doctium/doctium-tele-app`.
2. Railway reads `railway.json` automatically (build, migrate-on-deploy, start, healthcheck).
3. **Variables** → add everything from the checklist below.
4. Deploy. The release step runs `prisma migrate deploy`; then the API starts and the
   `/api/v1/health` check must pass.
5. **Seed reference data once** (Railway → service → "…" → Run command, or `railway run`):
   ```bash
   node scripts/seed-hr.cjs          # roles, departments, super-admin principal
   node scripts/seed-regions.cjs     # countries / pricing regions
   node scripts/seed-plans.cjs       # DoctiumPlus plans
   node scripts/seed-care-programs.cjs
   ```
   Do **NOT** run seed-rx-test / seed-pay-test (those are dev fixtures).
6. **Custom domain** → add `api.doctiumhealth.com`; Railway gives you a CNAME target.

### Railway environment variables

| Variable                                                 | Value                                      |
| -------------------------------------------------------- | ------------------------------------------ |
| `NODE_ENV`                                               | `production`                               |
| `DATABASE_URL`                                           | Neon direct connection string (step 1)     |
| `COOKIE_DOMAIN`                                          | `.doctiumhealth.com`                       |
| `JWT_SECRET` / `JWT_REFRESH_SECRET`                      | generated (step 0)                         |
| `RX_PRIVATE_KEY`                                         | generated prod key (step 0)                |
| `API_PUBLIC_URL`                                         | `https://api.doctiumhealth.com`            |
| `PUBLIC_WEB_URL`                                         | `https://doctiumhealth.com`                |
| `ADMIN_PANEL_URL`                                        | `https://dashboard.doctiumhealth.com`      |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY`            | live keys (already have)                   |
| `PAYSTACK_AUTO_PAYOUT`                                   | `true` when ready to auto-disburse payouts |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`     | already have                               |
| `FIREBASE_PROJECT_ID` / `_CLIENT_EMAIL` / `_PRIVATE_KEY` | already have (\n-escaped)                  |
| `SMS_PROVIDER`                                           | `africastalking` (preferred) or `termii`   |
| `AT_API_KEY` / `AT_USERNAME` / `AT_SENDER_ID`            | Africa's Talking (preferred SMS provider)  |
| `AT_SANDBOX`                                             | `true` to test via AT sandbox (no sender)  |
| `TERMII_API_KEY` / `TERMII_SENDER_ID`                    | legacy SMS fallback (`N-Alert`)            |
| `SMTP_HOST/PORT/USER/PASS/FROM`                          | Resend (already have)                      |
| `OPENAI_API_KEY` (+ model vars if customized)            | already have                               |
| `ZEGO_APP_ID` / `ZEGO_SERVER_SECRET`                     | already have                               |
| `SENTRY_DSN`                                             | doctium-api DSN                            |
| `APP_TIMEZONE_OFFSET`                                    | `+01:00`                                   |

> Do **not** set `PORT` — Railway injects it and the API reads `process.env.PORT`.

### ⚠️ Rotate the seeded admin password

`seed-hr` creates a super-admin with a known default. Immediately log in to the admin
and change its password (or update it directly in the DB) before going live.

---

## 3. Vercel (admin → dashboard.doctiumhealth.com)

1. Import the GitHub repo → set **Root Directory = `apps/admin-panel`**.
2. Vercel auto-detects Next.js. Environment variables:
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://api.doctiumhealth.com/api/v1` |
   | `NEXT_PUBLIC_SENTRY_DSN` | doctium-admin DSN |
   | `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | optional, for readable stack traces |
3. Deploy → add custom domain `dashboard.doctiumhealth.com`.

---

## 4. Cloudflare DNS (doctiumhealth.com)

- `api` → CNAME to the Railway-provided target (proxy **DNS only** / grey-cloud initially
  to avoid double-proxy TLS issues; can enable proxy later).
- `dashboard` → CNAME to Vercel (`cname.vercel-dns.com`).
- Root `doctiumhealth.com` / `www` → your landing page when it exists.
- Resend email records (MX/DKIM/SPF on `send`) — already added.

---

## 5. Smoke test (against production)

```bash
curl https://api.doctiumhealth.com/api/v1/health           # {status:ok}
curl https://api.doctiumhealth.com/api/v1/health/ready      # {db:up}
API_BASE=https://api.doctiumhealth.com/api/v1 node scripts/test-token-refresh.cjs
API_BASE=https://api.doctiumhealth.com/api/v1 node scripts/test-admin-csrf.cjs
```

Then log into `dashboard.doctiumhealth.com`, confirm it loads + auth works, and trigger a
test error to confirm it lands in Sentry.

---

## Mobile (separate track, when ready)

EAS build for both apps with `EXPO_PUBLIC_API_URL=https://api.doctiumhealth.com` and each
app's `EXPO_PUBLIC_SENTRY_DSN`; this is also what activates native Zego video, FCM push,
and native Sentry crash capture (none of which work in Expo Go).
