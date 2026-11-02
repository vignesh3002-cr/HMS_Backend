-- Prescription / visit linkage + sequence repair.
--
-- 1. A prescription is one per encounter: encounter_no lets the API reuse
--    (and idempotently merge into) the visit's prescription instead of
--    creating a second row on every submit.
-- 2. prescription_items keep the planned cycle/day/order they came from, so a
--    prescription can be traced back to the chemotherapy plan's drug role.
-- 3. patient_history links to the encounter too (walk-in visits have no
--    appointment), and at most one history row may own an appointment.
-- 4. Repair the two id_sequences rows that drifted behind the data (a data
--    import bypassed the sequence). GREATEST keeps an already-correct value.
--
-- Additive only; safe to run more than once.

BEGIN;

ALTER TABLE public.prescription
    ADD COLUMN IF NOT EXISTS encounter_no VARCHAR(100);

-- One prescription per visit. Re-submitting a visit must reuse its row rather
-- than create a second one; the partial index enforces that at the DB level
-- while leaving legacy rows (encounter_no IS NULL) untouched.
DROP INDEX IF EXISTS public.idx_prescription_encounter;
CREATE UNIQUE INDEX IF NOT EXISTS uq_prescription_encounter
    ON public.prescription (encounter_no)
    WHERE encounter_no IS NOT NULL;

ALTER TABLE public.patient_history
    ADD COLUMN IF NOT EXISTS encounter_no VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_patient_history_encounter
    ON public.patient_history (encounter_no);

-- One visit history per appointment. Existing rows were checked for
-- duplicates before adding this (none found).
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_history_appointment
    ON public.patient_history (appointment_id)
    WHERE appointment_id IS NOT NULL;

ALTER TABLE public.prescription_items
    ADD COLUMN IF NOT EXISTS chemotherapy_plan_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS plan_order_id        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS plan_item_id         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cycle_number         INT,
    ADD COLUMN IF NOT EXISTS cycle_day            INT;

CREATE INDEX IF NOT EXISTS idx_prescription_items_plan_order
    ON public.prescription_items (plan_order_id);

UPDATE public.id_sequences
SET current_number = GREATEST(current_number, 102), updated_at = now()
WHERE entity_name = 'PATIENT_HISTORY';

UPDATE public.id_sequences
SET current_number = GREATEST(current_number, 78), updated_at = now()
WHERE entity_name = 'CHEMOTHERAPY_PLAN';

-- Found by prisma/checkSequences.ts after the two above were repaired. The
-- generator's max-suffix guard would self-heal these on first use; repairing
-- them keeps the sequence audit green and ids gap-free.
UPDATE public.id_sequences
SET current_number = GREATEST(current_number, 105), updated_at = now()
WHERE entity_name = 'CHEMOTHERAPY_CYCLE';

UPDATE public.id_sequences
SET current_number = GREATEST(current_number, 438), updated_at = now()
WHERE entity_name = 'STAGING_DETAIL';

COMMIT;
