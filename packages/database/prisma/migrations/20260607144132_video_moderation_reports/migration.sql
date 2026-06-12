-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('UPLOAD', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "VideoReportReason" AS ENUM ('MISINFORMATION', 'HARMFUL_ADVICE', 'SPAM', 'SEXUAL_CONTENT', 'HARASSMENT', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "VideoReportStatus" AS ENUM ('OPEN', 'REVIEWED');

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "source" "VideoSource" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN     "status" "VideoStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill: clips that already existed before moderation were effectively live,
-- so grandfather them in as APPROVED rather than hiding them behind review.
UPDATE "videos" SET "status" = 'APPROVED';

-- CreateTable
CREATE TABLE "video_reports" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "VideoReportReason" NOT NULL,
    "note" TEXT,
    "status" "VideoReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_reports_videoId_idx" ON "video_reports"("videoId");

-- CreateIndex
CREATE INDEX "video_reports_status_idx" ON "video_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "video_reports_videoId_userId_key" ON "video_reports"("videoId", "userId");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- AddForeignKey
ALTER TABLE "video_reports" ADD CONSTRAINT "video_reports_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_reports" ADD CONSTRAINT "video_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
