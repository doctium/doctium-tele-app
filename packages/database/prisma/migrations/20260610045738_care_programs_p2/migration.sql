-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoalDirection" AS ENUM ('AT_OR_BELOW', 'AT_OR_ABOVE');

-- AlterTable
ALTER TABLE "program_enrollments" ADD COLUMN     "lastCheckInAt" TIMESTAMP(3),
ADD COLUMN     "lastEscalationAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "program_goals" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "doctorId" TEXT,
    "type" "VitalType" NOT NULL,
    "direction" "GoalDirection" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetValue2" DOUBLE PRECISION,
    "title" TEXT NOT NULL DEFAULT '',
    "dueDate" TIMESTAMP(3),
    "startValue" DOUBLE PRECISION,
    "startValue2" DOUBLE PRECISION,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_goals_enrollmentId_status_idx" ON "program_goals"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "program_goals_status_dueDate_idx" ON "program_goals"("status", "dueDate");

-- AddForeignKey
ALTER TABLE "program_goals" ADD CONSTRAINT "program_goals_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "program_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
