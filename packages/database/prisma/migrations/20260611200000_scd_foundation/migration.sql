-- SCD Phase 3 foundation: hydration tracking, genotype-stratified program
-- protocols, genotype snapshot on enrollments, and the crisis diary.

ALTER TYPE "VitalType" ADD VALUE IF NOT EXISTS 'HYDRATION';

ALTER TABLE "care_programs"
  ADD COLUMN "genotypeConfig" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "program_enrollments"
  ADD COLUMN "genotype" TEXT NOT NULL DEFAULT '';

CREATE TABLE "crisis_events" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subPatientId" TEXT,
  "painScore" INTEGER NOT NULL,
  "sites" JSONB NOT NULL DEFAULT '[]',
  "triggers" JSONB NOT NULL DEFAULT '[]',
  "treatment" TEXT NOT NULL DEFAULT '',
  "hospitalized" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT NOT NULL DEFAULT '',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crisis_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crisis_events_enrollmentId_startedAt_idx"
  ON "crisis_events"("enrollmentId", "startedAt");
CREATE INDEX "crisis_events_userId_idx" ON "crisis_events"("userId");

ALTER TABLE "crisis_events"
  ADD CONSTRAINT "crisis_events_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "program_enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crisis_events"
  ADD CONSTRAINT "crisis_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
