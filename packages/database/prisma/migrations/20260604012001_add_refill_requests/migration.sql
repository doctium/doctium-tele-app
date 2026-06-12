-- CreateEnum
CREATE TYPE "RefillRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "refill_requests" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "RefillRequestStatus" NOT NULL DEFAULT 'PENDING',
    "patientNote" TEXT NOT NULL DEFAULT '',
    "doctorNote" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refill_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refill_requests_doctorId_status_idx" ON "refill_requests"("doctorId", "status");

-- CreateIndex
CREATE INDEX "refill_requests_prescriptionId_idx" ON "refill_requests"("prescriptionId");

-- CreateIndex
CREATE INDEX "refill_requests_requestedByUserId_idx" ON "refill_requests"("requestedByUserId");

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_requests" ADD CONSTRAINT "refill_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
