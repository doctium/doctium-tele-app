-- CreateEnum
CREATE TYPE "TriageMode" AS ENUM ('TRIAGE', 'QA');

-- AlterTable
ALTER TABLE "triage_sessions" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "mode" "TriageMode" NOT NULL DEFAULT 'TRIAGE';
