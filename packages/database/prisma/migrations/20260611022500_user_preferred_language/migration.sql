-- Preferred app/communication language for patients (en | pcm | ha | yo | ig | …).
-- Drives the patient app UI today and notification/email language in a later phase.
ALTER TABLE "users" ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'en';
