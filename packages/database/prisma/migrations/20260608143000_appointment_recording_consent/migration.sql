-- CreateEnum
CREATE TYPE "RecordingConsentStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'CONSENTED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RecordingConsentActorRole" AS ENUM ('USER', 'DOCTOR', 'ADMIN');

-- CreateTable
CREATE TABLE "appointment_recording_consents" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "status" "RecordingConsentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByRole" "RecordingConsentActorRole" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientConsentedAt" TIMESTAMP(3),
    "doctorConsentedAt" TIMESTAMP(3),
    "patientDeclinedAt" TIMESTAMP(3),
    "doctorDeclinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByRole" "RecordingConsentActorRole",
    "revokedById" TEXT,
    "patientConsentIp" TEXT,
    "doctorConsentIp" TEXT,
    "patientUserAgent" TEXT,
    "doctorUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_recording_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_recording_consents_appointmentId_key" ON "appointment_recording_consents"("appointmentId");

-- CreateIndex
CREATE INDEX "appointment_recording_consents_status_idx" ON "appointment_recording_consents"("status");

-- CreateIndex
CREATE INDEX "appointment_recording_consents_requestedAt_idx" ON "appointment_recording_consents"("requestedAt");

-- AddForeignKey
ALTER TABLE "appointment_recording_consents" ADD CONSTRAINT "appointment_recording_consents_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
