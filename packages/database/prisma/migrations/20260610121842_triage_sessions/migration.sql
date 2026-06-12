-- CreateEnum
CREATE TYPE "TriageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TriageUrgency" AS ENUM ('EMERGENCY', 'URGENT_CONSULT', 'CONSULT_24H', 'ROUTINE', 'SELF_CARE');

-- CreateEnum
CREATE TYPE "TriageDisposition" AS ENUM ('INSTANT_CONSULT', 'BOOKED', 'DISMISSED');

-- CreateTable
CREATE TABLE "triage_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subPatientId" TEXT,
    "status" "TriageStatus" NOT NULL DEFAULT 'ACTIVE',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "turns" INTEGER NOT NULL DEFAULT 0,
    "redFlag" TEXT,
    "urgency" "TriageUrgency",
    "specialty" TEXT,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "selfCare" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "disposition" "TriageDisposition",
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triage_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "triage_sessions_userId_createdAt_idx" ON "triage_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "triage_sessions_appointmentId_idx" ON "triage_sessions"("appointmentId");

-- AddForeignKey
ALTER TABLE "triage_sessions" ADD CONSTRAINT "triage_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
