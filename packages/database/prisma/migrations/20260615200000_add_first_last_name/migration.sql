-- Add structured firstName/lastName alongside the denormalized `name` display field
-- on User and Doctor. `name` stays in sync (kept as the display source for existing
-- consumers); firstName/lastName become the structured source captured at signup.

ALTER TABLE "User" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Doctor" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Doctor" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';

-- Backfill the structured fields from the existing single `name` (split on the
-- first space: "John Doe" -> first "John", last "Doe"; "Madonna" -> first only).
UPDATE "User"
SET "firstName" = split_part("name", ' ', 1),
    "lastName"  = CASE WHEN position(' ' in "name") > 0
                       THEN btrim(substring("name" from position(' ' in "name") + 1))
                       ELSE '' END
WHERE "name" <> '' AND "firstName" = '';

UPDATE "Doctor"
SET "firstName" = split_part("name", ' ', 1),
    "lastName"  = CASE WHEN position(' ' in "name") > 0
                       THEN btrim(substring("name" from position(' ' in "name") + 1))
                       ELSE '' END
WHERE "name" <> '' AND "firstName" = '';
