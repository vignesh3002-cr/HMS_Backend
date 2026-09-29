-- Chemotherapy Order: per-drug "Dose Cal" + "Patient Dose".
-- Source formulas: EMR_Oncology_Master_Data_Spec.docx, Section 4.
--
-- chemotherapy_plan_items already has dose_calculation_method (Dose Cal) and
-- calculated_dose (Patient Dose); only the patient-dose unit is missing
-- (e.g. mg/m2 protocol dose -> mg patient dose). protocol_dose keeps the
-- unscaled protocol value (mg/m2, mg/kg, AUC, mg).
--
-- chemotherapy_plan gets a snapshot of the inputs the patient doses were
-- calculated from, so every calculated_dose is reproducible.

BEGIN;

ALTER TABLE public.chemotherapy_plan_items
    ADD COLUMN IF NOT EXISTS calculated_dose_unit VARCHAR(50);

ALTER TABLE public.chemotherapy_plan
    ADD COLUMN IF NOT EXISTS dosing_height_cm        NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS dosing_weight_kg        NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS dosing_bsa              NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS dosing_serum_creatinine NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS dosing_crcl             NUMERIC(7, 2);

COMMIT;
