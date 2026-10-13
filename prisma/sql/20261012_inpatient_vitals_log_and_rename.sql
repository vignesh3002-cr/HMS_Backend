-- Multi-Entry Inpatient Vitals & Rename encounter_type from 'IPD' to 'Inpatient (IPD)'
--
-- 1. Add vitals_log column to encounter table (stores timestamped JSON array of vitals)
-- 2. Rename encounter_type from 'IPD' to 'Inpatient (IPD)'
-- 3. Update patient_history visit_type from 'IPD' to 'Inpatient (IPD)'

BEGIN;

ALTER TABLE public.encounter
    ADD COLUMN IF NOT EXISTS vitals_log jsonb;

UPDATE public.encounter
SET encounter_type = 'Inpatient (IPD)'
WHERE encounter_type = 'IPD';

UPDATE public.patient_history
SET visit_type = 'Inpatient (IPD)'
WHERE visit_type = 'IPD';

COMMIT;

