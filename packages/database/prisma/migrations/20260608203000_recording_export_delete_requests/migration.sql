CREATE TYPE "RecordingRequestType" AS ENUM ('EXPORT', 'DELETE');

CREATE TYPE "RecordingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "appointment_recording_requests" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "assetId" TEXT,
    "type" "RecordingRequestType" NOT NULL,
    "status" "RecordingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByRole" "RecordingConsentActorRole" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "decisionById" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "disputeHold" BOOLEAN NOT NULL DEFAULT false,
    "disputeHoldUntil" TIMESTAMP(3),
    "disputeHoldReason" TEXT,
    "exportUrl" TEXT,
    "exportExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_recording_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointment_recording_requests_appointmentId_idx" ON "appointment_recording_requests"("appointmentId");
CREATE INDEX "appointment_recording_requests_assetId_idx" ON "appointment_recording_requests"("assetId");
CREATE INDEX "appointment_recording_requests_type_status_idx" ON "appointment_recording_requests"("type", "status");
CREATE INDEX "appointment_recording_requests_createdAt_idx" ON "appointment_recording_requests"("createdAt");

ALTER TABLE "appointment_recording_requests" ADD CONSTRAINT "appointment_recording_requests_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_recording_requests" ADD CONSTRAINT "appointment_recording_requests_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "appointment_recording_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
