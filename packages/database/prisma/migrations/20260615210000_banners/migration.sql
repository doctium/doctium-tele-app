-- Reshape the legacy "banners" table into the richer home-slider model.
-- (type SERVICE|URL + serviceId/url  ->  type EXTERNAL|APP + unified target,
--  plus title/sortOrder/schedule/clickCount.) Safe whether the table is empty
-- or holds legacy rows.

ALTER TABLE "banners" DROP CONSTRAINT IF EXISTS "banners_serviceId_fkey";

ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "target" TEXT NOT NULL DEFAULT '';
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "clickCount" INTEGER NOT NULL DEFAULT 0;

-- Preserve any existing destination URL into the unified target field.
UPDATE "banners" SET "target" = COALESCE("url", '') WHERE "target" = '' AND "url" IS NOT NULL;

-- Switch the enum SERVICE|URL -> EXTERNAL|APP (map legacy values first).
ALTER TABLE "banners" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "banners" ALTER COLUMN "type" TYPE TEXT;
UPDATE "banners" SET "type" = 'EXTERNAL' WHERE "type" = 'URL';
UPDATE "banners" SET "type" = 'APP' WHERE "type" = 'SERVICE';
DROP TYPE "BannerType";
CREATE TYPE "BannerType" AS ENUM ('EXTERNAL', 'APP');
ALTER TABLE "banners" ALTER COLUMN "type" TYPE "BannerType" USING ("type"::"BannerType");
ALTER TABLE "banners" ALTER COLUMN "type" SET DEFAULT 'APP';

ALTER TABLE "banners" DROP COLUMN IF EXISTS "serviceId";
ALTER TABLE "banners" DROP COLUMN IF EXISTS "url";

CREATE INDEX IF NOT EXISTS "banners_isActive_sortOrder_idx" ON "banners"("isActive", "sortOrder");
