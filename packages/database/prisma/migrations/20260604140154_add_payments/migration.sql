-- CreateEnum
CREATE TYPE "AppointmentMode" AS ENUM ('SCHEDULED', 'INSTANT');

-- CreateEnum
CREATE TYPE "PaymentTxnType" AS ENUM ('WALLET_TOPUP', 'APPOINTMENT_PAYMENT', 'REFUND', 'PAYOUT');

-- CreateEnum
CREATE TYPE "PaymentTxnStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "PaymentGateway" ADD VALUE 'PAYSTACK';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "mode" "AppointmentMode" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "paymentRef" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "doctor_wallets" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN';

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "instantDayFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "instantNightFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "nationality" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "practiceCountry" TEXT NOT NULL DEFAULT 'NG',
ADD COLUMN     "scheduledFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_wallets" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN';

-- CreateTable
CREATE TABLE "regions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "PaymentTxnType" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'WALLET',
    "status" "PaymentTxnStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "doctorId" TEXT,
    "appointmentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "channel" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dedicated_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "paystackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dedicated_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_reference_key" ON "payment_transactions"("reference");

-- CreateIndex
CREATE INDEX "payment_transactions_userId_idx" ON "payment_transactions"("userId");

-- CreateIndex
CREATE INDEX "payment_transactions_doctorId_idx" ON "payment_transactions"("doctorId");

-- CreateIndex
CREATE INDEX "payment_transactions_appointmentId_idx" ON "payment_transactions"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "dedicated_accounts_userId_key" ON "dedicated_accounts"("userId");
