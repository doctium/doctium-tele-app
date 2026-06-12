-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "otps" ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "mobile" SET DEFAULT '';

-- CreateIndex
CREATE INDEX "otps_email_idx" ON "otps"("email");
