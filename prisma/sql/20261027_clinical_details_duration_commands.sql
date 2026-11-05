-- Consultation > Clinical Details / Personal History: per-selected-value
-- Duration (numeric value + day/week/month/year unit) and Command(s).
--
--   * encounter_symptom keeps duration_days as the canonical value and gains
--     duration_unit so the editor can show the unit the doctor picked.
--   * patient_allergy / patient_comorbidity gain duration_value + duration_unit.
--     Command(s) reuse their existing (previously unused) clinical_notes column.
--   * Drug Consumption duration + commands live inside the existing
--     patient_personal_history.drug_consumption JSON, so no change is needed.
--
-- Run once against the application database before starting the new backend.

BEGIN;

ALTER TABLE public.encounter_symptom
    ADD COLUMN IF NOT EXISTS duration_unit VARCHAR(20);

ALTER TABLE public.patient_allergy
    ADD COLUMN IF NOT EXISTS duration_value INTEGER,
    ADD COLUMN IF NOT EXISTS duration_unit VARCHAR(20);

ALTER TABLE public.patient_comorbidity
    ADD COLUMN IF NOT EXISTS duration_value INTEGER,
    ADD COLUMN IF NOT EXISTS duration_unit VARCHAR(20);

COMMIT;
