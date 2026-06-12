-- AlterTable
ALTER TABLE "care_programs" ADD COLUMN     "suggestKeywords" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "triage_sessions" ADD COLUMN     "suggestedProgramId" TEXT;
