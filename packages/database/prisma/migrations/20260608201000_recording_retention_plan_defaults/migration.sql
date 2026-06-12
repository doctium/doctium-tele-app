UPDATE "subscription_plans"
SET
  "benefits" = jsonb_set("benefits", '{recordingRetentionDays}', '30'::jsonb, true),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('patient_basic', 'doctor_standard');

UPDATE "subscription_plans"
SET
  "benefits" = jsonb_set("benefits", '{recordingRetentionDays}', '90'::jsonb, true),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('patient_family', 'doctor_featured');

UPDATE "subscription_plans"
SET
  "benefits" = jsonb_set("benefits", '{recordingRetentionDays}', '180'::jsonb, true),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('patient_pro', 'doctor_premium');
