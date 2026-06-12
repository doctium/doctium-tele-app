-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('PENDING', 'SENT', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "satisfaction_surveys" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "subPatientId" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "npsScore" INTEGER,
    "categories" JSONB NOT NULL DEFAULT '{}',
    "comment" TEXT NOT NULL DEFAULT '',
    "wouldBookAgain" BOOLEAN,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "satisfaction_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "satisfaction_surveys_appointmentId_key" ON "satisfaction_surveys"("appointmentId");

-- CreateIndex
CREATE INDEX "satisfaction_surveys_status_scheduledFor_idx" ON "satisfaction_surveys"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "satisfaction_surveys_doctorId_respondedAt_idx" ON "satisfaction_surveys"("doctorId", "respondedAt");

-- CreateIndex
CREATE INDEX "satisfaction_surveys_userId_idx" ON "satisfaction_surveys"("userId");

-- AddForeignKey
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
