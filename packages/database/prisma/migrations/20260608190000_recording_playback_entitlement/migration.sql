UPDATE "subscription_plans"
SET
  "benefits" = jsonb_set("benefits", '{recordingPlayback}', 'true'::jsonb, true),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('patient_pro', 'doctor_premium');
