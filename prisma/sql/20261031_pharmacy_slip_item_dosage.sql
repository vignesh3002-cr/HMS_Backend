-- Pharmacy Slip (Discharge Medication popup) columns.
--
-- The popup shows the full medicine row, not just the four columns of the
-- pharmacist's slip:
--   dosage_form   the ordered medicine's form (Tab / Inj / Cap ...)
--   patient_dose  the patient's calculated dose, kept separately from `dose`
--                 which is the brand strength the doctor selected
--
-- Both are idempotent so this file can be re-run safely.

BEGIN;

ALTER TABLE public.pharmacy_slip_item
    ADD COLUMN IF NOT EXISTS dosage_form  VARCHAR(100);

ALTER TABLE public.pharmacy_slip_item
    ADD COLUMN IF NOT EXISTS patient_dose VARCHAR(100);

COMMIT;
