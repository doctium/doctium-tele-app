-- Fix: email @unique @default("") meant only ONE email-less signup could ever
-- exist (second registration without email collided on ""). Nullable + NULL
-- for empties — Postgres unique indexes ignore NULLs.

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "email" DROP DEFAULT;

-- Existing empty-string emails become NULL
UPDATE "users" SET "email" = NULL WHERE "email" = '';
