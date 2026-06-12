ALTER TYPE "RecordingAssetStatus" ADD VALUE 'ARCHIVED';

ALTER TABLE "appointment_recording_assets"
ADD COLUMN "retentionPolicy" TEXT NOT NULL DEFAULT 'STANDARD_90_DAYS',
ADD COLUMN "retentionDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN "retainUntil" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "appointment_recording_assets"
SET "retainUntil" = "createdAt" + ("retentionDays" * INTERVAL '1 day')
WHERE "retainUntil" IS NULL;

CREATE INDEX "appointment_recording_assets_retainUntil_idx" ON "appointment_recording_assets"("retainUntil");
