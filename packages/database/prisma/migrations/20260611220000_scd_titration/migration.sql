-- SCD Phase 5: hydroxyurea titration support — CBC lab results, the dose-change
-- log, and the 14-day throttle for "CBC due" reminders.

ALTER TABLE "program_enrollments"
  ADD COLUMN "lastLabReminderAt" TIMESTAMP(3);

CREATE TABLE "lab_results" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subPatientId" TEXT,
  "hb" DOUBLE PRECISION,
  "wbc" DOUBLE PRECISION,
  "anc" DOUBLE PRECISION,
  "platelets" DOUBLE PRECISION,
  "mcv" DOUBLE PRECISION,
  "note" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT 'PATIENT',
  "recordedById" TEXT,
  "flags" JSONB NOT NULL DEFAULT '[]',
  "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lab_results_enrollmentId_takenAt_idx"
  ON "lab_results"("enrollmentId", "takenAt");
CREATE INDEX "lab_results_userId_idx" ON "lab_results"("userId");

ALTER TABLE "lab_results"
  ADD CONSTRAINT "lab_results_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "program_enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_results"
  ADD CONSTRAINT "lab_results_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "medication_doses" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subPatientId" TEXT,
  "medication" TEXT NOT NULL DEFAULT 'hydroxyurea',
  "doseMgPerDay" INTEGER NOT NULL,
  "weightKg" DOUBLE PRECISION,
  "note" TEXT NOT NULL DEFAULT '',
  "setByDoctorId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "medication_doses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medication_doses_enrollmentId_startedAt_idx"
  ON "medication_doses"("enrollmentId", "startedAt");

ALTER TABLE "medication_doses"
  ADD CONSTRAINT "medication_doses_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "program_enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
