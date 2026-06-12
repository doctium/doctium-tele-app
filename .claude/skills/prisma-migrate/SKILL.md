---
name: prisma-migrate
description: Safely create and apply a Prisma migration for the Doctium database (packages/database). Reviews the schema diff, validates, names the migration, runs migrate + client regeneration, and verifies. User-invoked because it mutates the database.
disable-model-invocation: true
---

# Prisma Migrate (Doctium)

Run this when the schema in `packages/database/prisma/schema.prisma` has changed and you need a migration. The database is local PostgreSQL (PG17); `DATABASE_URL` comes from the root `.env`.

## Safety first
- This MUTATES the database. Don't run against production data without a backup.
- NEVER run `prisma migrate reset` or any `--force` reset unless the user explicitly asks — it drops all data.
- Confirm `DATABASE_URL` points at the intended (local) database before applying.

## Workflow

1. **Review the change.** Show the pending schema diff:
   - `git diff -- packages/database/prisma/schema.prisma` (if git is initialized), otherwise summarize the model/field changes you're about to migrate.
2. **Validate the schema.**
   - `npx prisma validate --schema packages/database/prisma/schema.prisma`
3. **Name the migration** in snake_case describing the change (e.g. `add_refill_request_status`). Confirm the name with the user.
4. **Create + apply (dev).**
   - `npm run db:migrate -- --name <migration_name>`
   - (proxies to the `@doctium/database` workspace's `prisma migrate dev`)
5. **Regenerate the client** so all four workspaces pick up the new types:
   - `npm run db:generate`
6. **Type-check consumers.**
   - `npm run typecheck`
7. **Verify** the migration landed:
   - Check for a new folder under `packages/database/prisma/migrations/`, and/or open `npm run db:studio` to eyeball the schema.

## After migrating
- Update affected DTOs / zod schemas in `packages/validation` and types in `packages/types`.
- In your summary, state which models changed and whether a data backfill is needed.
