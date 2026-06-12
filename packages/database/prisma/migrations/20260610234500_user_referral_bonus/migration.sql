-- Referral bonus program: share code + referrer link + one-time reward marker.
-- referralCode is nullable; existing rows stay NULL (NULLs never collide on a
-- Postgres unique index) and are backfilled by scripts/backfill-referral-codes.cjs.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "referralCode" TEXT,
ADD COLUMN "referredById" TEXT,
ADD COLUMN "referralRewardedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");
