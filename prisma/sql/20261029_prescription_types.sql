-- Prescription types: one Advice prescription and one chemotherapy
-- prescription may legitimately exist for the same visit.
--
-- A patient can be seen as an outpatient, receive Advice medicines, and then
-- proceed to a chemotherapy plan on the same day. Those are two different
-- prescriptions for one encounter (and one patient_history row), so the old
-- "one prescription per encounter" unique index is replaced by one
-- prescription per (encounter, type).
--
-- Additive; safe to run more than once.

BEGIN;

ALTER TABLE public.prescription
    ADD COLUMN IF NOT EXISTS prescription_type VARCHAR(20);

ALTER TABLE public.prescription
    ALTER COLUMN prescription_type SET DEFAULT 'GENERAL';

-- Backfill existing rows from their items:
--   only ADVICE items                      -> ADVICE
--   plan-linked / clinical-role items      -> CHEMOTHERAPY
--   anything else (legacy/empty)           -> GENERAL
UPDATE public.prescription p
SET prescription_type = CASE
    WHEN EXISTS (
        SELECT 1 FROM public.prescription_items i
        WHERE i.prescription_id = p.prescription_id
          AND upper(coalesce(i.drug_role, '')) = 'ADVICE'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.prescription_items i
        WHERE i.prescription_id = p.prescription_id
          AND (
              i.chemotherapy_plan_id IS NOT NULL
              OR i.plan_order_id IS NOT NULL
              OR i.plan_item_id IS NOT NULL
          )
    ) THEN 'ADVICE'
    WHEN EXISTS (
        SELECT 1 FROM public.prescription_items i
        WHERE i.prescription_id = p.prescription_id
          AND (
              i.chemotherapy_plan_id IS NOT NULL
              OR i.plan_order_id IS NOT NULL
              OR i.plan_item_id IS NOT NULL
              OR upper(coalesce(i.drug_role, '')) IN (
                  'PRIMARY', 'PREMEDICATION', 'POSTMEDICATION',
                  'SUPPORTIVE', 'DILUTION', 'DISCHARGE'
              )
          )
    ) THEN 'CHEMOTHERAPY'
    ELSE 'GENERAL'
END
WHERE p.prescription_type IS NULL;

ALTER TABLE public.prescription
    ALTER COLUMN prescription_type SET NOT NULL;

-- One prescription per encounter is no longer correct: drop the unique
-- index introduced for that model and keep a plain lookup index.
DROP INDEX IF EXISTS public.uq_prescription_encounter;

CREATE INDEX IF NOT EXISTS idx_prescription_encounter
    ON public.prescription (encounter_no);

-- At most one active Advice and one active chemotherapy prescription per
-- visit. Cancelled rows are excluded so a cleared and re-added prescription
-- for the same visit is still possible. GENERAL/legacy rows stay
-- unconstrained.
DROP INDEX IF EXISTS public.uq_prescription_encounter_type;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prescription_encounter_type
    ON public.prescription (encounter_no, prescription_type)
    WHERE encounter_no IS NOT NULL
      AND prescription_type IN ('ADVICE', 'CHEMOTHERAPY')
      AND prescription_status <> 'CANCELLED';

COMMIT;
