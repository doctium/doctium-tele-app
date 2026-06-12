-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "reminded30" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminded5" BOOLEAN NOT NULL DEFAULT false;
