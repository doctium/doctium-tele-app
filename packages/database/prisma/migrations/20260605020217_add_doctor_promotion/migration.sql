-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "discountActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discountEndsAt" TIMESTAMP(3),
ADD COLUMN     "discountLabel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
