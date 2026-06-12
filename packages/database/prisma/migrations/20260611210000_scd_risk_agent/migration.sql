-- SCD Phase 4: explainable crisis-risk assessments (daily care-agent sweep)
-- + 48h notification cooldown on enrollments.

ALTER TABLE "program_enrollments"
  ADD COLUMN "lastRiskAlertAt" TIMESTAMP(3);

CREATE TABLE "risk_assessments" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subPatientId" TEXT,
  "score" INTEGER NOT NULL,
  "level" TEXT NOT NULL,
  "factors" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "risk_assessments_enrollmentId_createdAt_idx"
  ON "risk_assessments"("enrollmentId", "createdAt");
CREATE INDEX "risk_assessments_userId_idx" ON "risk_assessments"("userId");

ALTER TABLE "risk_assessments"
  ADD CONSTRAINT "risk_assessments_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "program_enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments"
  ADD CONSTRAINT "risk_assessments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
