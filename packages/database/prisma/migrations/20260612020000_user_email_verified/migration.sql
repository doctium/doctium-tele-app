-- Email verification state for patients (6-digit OTP or emailed link).
ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
