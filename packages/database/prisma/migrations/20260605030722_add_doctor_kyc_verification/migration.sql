-- CreateEnum
CREATE TYPE "DoctorVerificationStatus" AS ENUM ('NEW', 'PENDING_KYC', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('CV', 'MEDICAL_LICENSE', 'DEGREE_CERTIFICATE', 'GOVERNMENT_ID', 'SPECIALIST_CERT', 'INDEMNITY_INSURANCE', 'PASSPORT_PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "KycDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "licenseExpiry" TIMESTAMP(3),
ADD COLUMN     "licenseNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mdcnFolioNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rejectionReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "verificationNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "verificationStatus" "DoctorVerificationStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "type" "KycDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "status" "KycDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kyc_documents_doctorId_idx" ON "kyc_documents"("doctorId");

-- CreateIndex
CREATE INDEX "kyc_documents_doctorId_type_idx" ON "kyc_documents"("doctorId", "type");

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
