# Doctium

Multi-sided telemedicine platform for the Nigerian market (Naira-first, multi-currency-ready). Patients book and pay for consultations, doctors run their practice and get paid, and admins operate the business. Includes EMR/FHIR, e-prescriptions (Ed25519-signed), AI symptom triage ("Leenah"), chronic-care programs, subscriptions, KYC, payments/escrow, and an HR/RBAC back office.

## Stack

| Surface                              | Tech                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| **API** (`apps/api`)                 | NestJS 10, Prisma 5, PostgreSQL, Socket.io, JWT auth, Jest                            |
| **Admin panel** (`apps/admin-panel`) | Next.js 15 (App Router), React 19, TanStack Query, Tailwind                           |
| **Patient app** (`apps/user-app`)    | Expo SDK 54, React Native 0.81, Redux Toolkit, i18n (en/pcm/ha/yo/ig)                 |
| **Doctor app** (`apps/doctor-app`)   | Expo SDK 54, React Native 0.81, Redux Toolkit                                         |
| **Shared** (`packages/*`)            | `database` (Prisma client + schema), `types`, `validation` (Zod), `brand`, `tsconfig` |

Monorepo managed with **npm workspaces + Turborepo**.

## Prerequisites

- Node.js ≥ 20, npm ≥ 10
- PostgreSQL (local or hosted)
- (Optional) Expo Go or a dev build to run the mobile apps

## Setup

```bash
# 1. Install all workspace deps from the repo root
npm install

# 2. Configure environment
cp .env.example .env          # then fill in DATABASE_URL + JWT_SECRET / JWT_REFRESH_SECRET (required)

# 3. Create the schema
npm run db:migrate            # dev (interactive)   — or: npm run db:migrate:prod (CI/non-interactive)
npm run db:generate           # regenerate the Prisma client

# 4. Seed reference data + test accounts
node --env-file=.env scripts/seed-admin.cjs
node --env-file=.env scripts/seed-hr.cjs        # roles/departments/super-admin (run after migrate)
node --env-file=.env scripts/seed-regions.cjs
node --env-file=.env scripts/seed-plans.cjs
# ...see scripts/ for feature-specific seeds (care programs, KYC, Rx test data, etc.)
```

The API **fails fast** if `JWT_SECRET` or `JWT_REFRESH_SECRET` are missing — set them before starting.

Most third-party integrations (Cloudinary, Firebase, SMTP, Termii, Zego, Paystack, OpenAI) are **no-op-safe**: the app runs without their credentials, degrading the relevant feature gracefully. See `.env.example` for the full, grouped list.

## Running

```bash
npm run dev        # turbo: runs all four apps together
```

| Service            | URL / Port                                            |
| ------------------ | ----------------------------------------------------- |
| API                | http://localhost:3001/api/v1 (Swagger at `/api/docs`) |
| Admin panel        | http://localhost:3000                                 |
| Patient app (Expo) | http://localhost:8081                                 |
| Doctor app (Expo)  | http://localhost:8082                                 |

Health checks: `GET /api/v1/health` (liveness), `GET /api/v1/health/ready` (DB readiness).

## Testing

```bash
npm run typecheck                 # tsc --noEmit across all workspaces
npm test --workspace=@doctium/api # Jest unit tests (pricing, webhook HMAC, Rx signing)

# Integration scripts (require a running API + seeded DB):
node --env-file=.env scripts/test-money-kobo.cjs
node --env-file=.env scripts/test-referrals.cjs
# ...see scripts/test-*.cjs for per-feature suites
```

## Test accounts (after seeding)

| Role    | Login                             |
| ------- | --------------------------------- |
| Admin   | `admin@doctium.com` / `admin123`  |
| Doctor  | `rxdoc@doctium.com` / `test1234`  |
| Patient | mobile `08000000002` / `test1234` |

## Conventions

- **API prefix:** every route is under `/api/v1`.
- **Response envelope:** all responses are wrapped as `{ status, message, data }`; clients unwrap `.data`.
- **Money is integer minor units (kobo).** Use the shared `formatMoney` / `toStoredAmount` / `toMajorUnits` helpers; never store floats.
- **Validation:** request bodies use class-validator DTOs; the global pipe runs `whitelist + forbidNonWhitelisted`, so unknown fields are rejected.
- **Auth:** class-level `JwtAuthGuard` + per-route `RolesGuard`/`@Roles`; admin routes also use `PermissionsGuard` + `@Permissions` (data-driven RBAC).
- **TypeScript is strict** (`noUncheckedIndexedAccess` on at the root).

## Database migrations

Migrations live in `packages/database/prisma/migrations` and are version-controlled (source of truth).

> Note: `prisma migrate dev` can hang on warning prompts in non-interactive shells. For those, hand-write the `migration.sql` and apply with `npm run db:migrate:prod` (`migrate deploy`).

## Deployment notes

- Set all required secrets in the environment (never commit `.env`).
- **Prescription signing key:** in production, provide `RX_PRIVATE_KEY` via env and remove the DB copy (`node scripts/export-rx-key.cjs` prints the cutover steps). Verification grandfathers signatures made with the previous key.
- The API enables graceful shutdown hooks (drains the DB pool on SIGTERM/SIGINT).
