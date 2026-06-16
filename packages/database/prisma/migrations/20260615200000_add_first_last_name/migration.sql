-- Add structured firstName/lastName alongside the denormalized `name` display field
-- on User and Doctor. NOTE: those models use @@map, so the real tables are
-- "users" / "doctors". `name` stays in sync (display source for existing consumers);
-- firstName/lastName become the structured source captured at signup.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "lastName" TEXT NOT NULL DEFAULT '';

-- Backfill the structured fields from the existing single `name` (split on the
-- first space: "John Doe" -> first "John", last "Doe"; "Madonna" -> first only).
UPDATE "users"
SET "firstName" = split_part("name", ' ', 1),
    "lastName"  = CASE WHEN position(' ' in "name") > 0
                       THEN btrim(substring("name" from position(' ' in "name") + 1))
                       ELSE '' END
WHERE "name" <> '' AND "firstName" = '';

UPDATE "doctors"
SET "firstName" = split_part("name", ' ', 1),
    "lastName"  = CASE WHEN position(' ' in "name") > 0
                       THEN btrim(substring("name" from position(' ' in "name") + 1))
                       ELSE '' END
WHERE "name" <> '' AND "firstName" = '';
