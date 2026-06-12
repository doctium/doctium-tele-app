-- DropIndex
DROP INDEX "health_profiles_userId_key";

-- AlterTable
ALTER TABLE "allergies" ADD COLUMN     "subPatientId" TEXT;

-- AlterTable
ALTER TABLE "health_profiles" ADD COLUMN     "subPatientId" TEXT;

-- AlterTable
ALTER TABLE "immunizations" ADD COLUMN     "subPatientId" TEXT;

-- AlterTable
ALTER TABLE "medical_conditions" ADD COLUMN     "subPatientId" TEXT;

-- AlterTable
ALTER TABLE "surgeries" ADD COLUMN     "subPatientId" TEXT;

-- CreateIndex
CREATE INDEX "allergies_subPatientId_idx" ON "allergies"("subPatientId");

-- CreateIndex
CREATE UNIQUE INDEX "health_profiles_subPatientId_key" ON "health_profiles"("subPatientId");

-- CreateIndex
CREATE INDEX "health_profiles_userId_idx" ON "health_profiles"("userId");

-- CreateIndex
CREATE INDEX "immunizations_subPatientId_idx" ON "immunizations"("subPatientId");

-- CreateIndex
CREATE INDEX "medical_conditions_subPatientId_idx" ON "medical_conditions"("subPatientId");

-- CreateIndex
CREATE INDEX "surgeries_subPatientId_idx" ON "surgeries"("subPatientId");

-- AddForeignKey
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_subPatientId_fkey" FOREIGN KEY ("subPatientId") REFERENCES "sub_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_conditions" ADD CONSTRAINT "medical_conditions_subPatientId_fkey" FOREIGN KEY ("subPatientId") REFERENCES "sub_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_subPatientId_fkey" FOREIGN KEY ("subPatientId") REFERENCES "sub_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_subPatientId_fkey" FOREIGN KEY ("subPatientId") REFERENCES "sub_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_subPatientId_fkey" FOREIGN KEY ("subPatientId") REFERENCES "sub_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_files" ADD CONSTRAINT "medical_files_subPatientId_fkey" FOREIGN KEY ("subPatientId") REFERENCES "sub_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

