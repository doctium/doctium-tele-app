-- AlterTable
ALTER TABLE "dedicated_accounts" ADD COLUMN     "customerCode" TEXT;

-- CreateIndex
CREATE INDEX "dedicated_accounts_customerCode_idx" ON "dedicated_accounts"("customerCode");
