-- CreateEnum
CREATE TYPE "RecordingAssetStatus" AS ENUM ('AVAILABLE', 'QUARANTINED', 'DELETED');

-- CreateTable
CREATE TABLE "appointment_recording_assets" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'ZEGO',
    "storageVendor" TEXT NOT NULL DEFAULT '',
    "status" "RecordingAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "bucket" TEXT,
    "region" TEXT,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
    "sizeBytes" BIGINT,
    "durationSeconds" INTEGER,
    "checksum" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "encryptionMethod" TEXT NOT NULL DEFAULT 'provider-managed',
    "providerTaskId" TEXT,
    "providerFileId" TEXT,
    "providerUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_recording_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_recording_access_logs" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "assetId" TEXT,
    "actorRole" "RecordingConsentActorRole" NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'ACCESS_URL',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_recording_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_recording_assets_appointmentId_objectKey_key" ON "appointment_recording_assets"("appointmentId", "objectKey");

-- CreateIndex
CREATE INDEX "appointment_recording_assets_appointmentId_idx" ON "appointment_recording_assets"("appointmentId");

-- CreateIndex
CREATE INDEX "appointment_recording_assets_sessionId_idx" ON "appointment_recording_assets"("sessionId");

-- CreateIndex
CREATE INDEX "appointment_recording_assets_status_idx" ON "appointment_recording_assets"("status");

-- CreateIndex
CREATE INDEX "appointment_recording_access_logs_appointmentId_idx" ON "appointment_recording_access_logs"("appointmentId");

-- CreateIndex
CREATE INDEX "appointment_recording_access_logs_assetId_idx" ON "appointment_recording_access_logs"("assetId");

-- CreateIndex
CREATE INDEX "appointment_recording_access_logs_createdAt_idx" ON "appointment_recording_access_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "appointment_recording_assets" ADD CONSTRAINT "appointment_recording_assets_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_recording_assets" ADD CONSTRAINT "appointment_recording_assets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "appointment_recording_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_recording_access_logs" ADD CONSTRAINT "appointment_recording_access_logs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
