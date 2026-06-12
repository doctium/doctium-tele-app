-- CreateEnum
CREATE TYPE "RecordingSessionStatus" AS ENUM ('STARTING', 'ACTIVE', 'STOPPING', 'STOPPED', 'FAILED');

-- CreateTable
CREATE TABLE "appointment_recording_sessions" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ZEGO',
    "status" "RecordingSessionStatus" NOT NULL DEFAULT 'STARTING',
    "roomId" TEXT NOT NULL,
    "taskId" TEXT,
    "clientTaskId" TEXT NOT NULL,
    "outputPrefix" TEXT NOT NULL DEFAULT '',
    "storageVendor" TEXT NOT NULL DEFAULT '',
    "startedByRole" "RecordingConsentActorRole" NOT NULL,
    "startedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "stoppedByRole" "RecordingConsentActorRole",
    "stoppedById" TEXT,
    "stoppedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_recording_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_recording_sessions_appointmentId_key" ON "appointment_recording_sessions"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_recording_sessions_clientTaskId_key" ON "appointment_recording_sessions"("clientTaskId");

-- CreateIndex
CREATE INDEX "appointment_recording_sessions_status_idx" ON "appointment_recording_sessions"("status");

-- CreateIndex
CREATE INDEX "appointment_recording_sessions_roomId_idx" ON "appointment_recording_sessions"("roomId");

-- AddForeignKey
ALTER TABLE "appointment_recording_sessions" ADD CONSTRAINT "appointment_recording_sessions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
