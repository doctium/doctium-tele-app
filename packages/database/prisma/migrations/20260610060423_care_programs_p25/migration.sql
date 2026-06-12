-- AlterEnum
ALTER TYPE "PaymentTxnType" ADD VALUE 'CARE_PROGRAM_PAYMENT';

-- AlterEnum
ALTER TYPE "WalletHistoryType" ADD VALUE 'CARE_PROGRAM_PAYMENT';

-- AlterTable
ALTER TABLE "program_enrollments" ADD COLUMN     "paidAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentRef" TEXT;

-- AddForeignKey
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_subPatientId_fkey" FOREIGN KEY ("subPatientId") REFERENCES "sub_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
