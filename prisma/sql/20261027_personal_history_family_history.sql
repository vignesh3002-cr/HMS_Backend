-- Consultation > Personal History > Family History.
--
-- Family History is stored inside the existing patient_personal_history row
-- (one row per encounter) as JSON so no new table or endpoint is needed:
--
--   {
--     "status": "PRESENT" | "NOT_PRESENT",
--     "entries": [
--       {
--         "degree": "1st" | "2nd" | "3rd",
--         "relative_type": "Mother",
--         "condition": "Breast Cancer",
--         "age_at_diagnosis": "45",
--         "remarks": "..."
--       }
--     ]
--   }
--
-- NULL means the doctor has not answered yet (neither PRESENT nor NOT PRESENT)
-- so a saved-but-unanswered form is never read back as a false negative.
--
-- Run once against the application database before starting the new backend.

BEGIN;

ALTER TABLE public.patient_personal_history
    ADD COLUMN IF NOT EXISTS family_history JSONB;

COMMIT;
