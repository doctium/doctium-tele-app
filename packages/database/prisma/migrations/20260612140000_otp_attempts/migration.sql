-- Track failed OTP verification attempts so we can lock a code after a cap.
ALTER TABLE "otps" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
