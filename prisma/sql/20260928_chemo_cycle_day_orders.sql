-- Chemotherapy orders per cycle + day, custom drug names, one open plan per
-- patient. Part A (additive; safe while the old code runs). Part B
-- (20260928_drop_plan_order_markers.sql) drops the superseded
-- chemotherapy_plan.order_day / hydration_saved columns.

BEGIN;

-- One saved order per plan + cycle + (medication) day. Its items and
-- hydration rows hang off it; plan items / hydration without an order are
-- the plan's baseline copy of the protocol.
CREATE TABLE IF NOT EXISTS public.chemotherapy_plan_order (
    id                       BIGSERIAL PRIMARY KEY,
    plan_order_id            VARCHAR(100) NOT NULL,
    chemotherapy_plan_id     VARCHAR(100) NOT NULL,
    chemotherapy_cycle_id    VARCHAR(100) NOT NULL,
    cycle_number             INT NOT NULL,
    cycle_day                INT NOT NULL,
    order_status             VARCHAR(20) NOT NULL DEFAULT 'ORDERED',
    -- The hydration list was saved for this day (possibly empty).
    hydration_saved          BOOLEAN NOT NULL DEFAULT FALSE,
    copied_from_order_id     VARCHAR(100),
    encounter_no             VARCHAR(100),
    -- The inputs this day's patient doses were calculated from.
    dosing_height_cm         NUMERIC(6, 2),
    dosing_weight_kg         NUMERIC(6, 2),
    dosing_bsa               NUMERIC(5, 2),
    dosing_serum_creatinine  NUMERIC(6, 2),
    dosing_crcl              NUMERIC(7, 2),
    completed_at             TIMESTAMP(6),
    created_by               VARCHAR(100),
    created_at               TIMESTAMP(6) DEFAULT now(),
    updated_at               TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_plan_order_id UNIQUE (plan_order_id),
    CONSTRAINT uq_plan_order_cycle_day UNIQUE (chemotherapy_plan_id, cycle_number, cycle_day),
    CONSTRAINT chk_plan_order_status CHECK (order_status IN ('ORDERED', 'COMPLETED')),
    CONSTRAINT chk_plan_order_cycle_day CHECK (cycle_number >= 1 AND cycle_day >= 1),
    CONSTRAINT fk_plan_order_plan FOREIGN KEY (chemotherapy_plan_id)
        REFERENCES public.chemotherapy_plan (chemotherapy_plan_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_plan_order_cycle FOREIGN KEY (chemotherapy_cycle_id)
        REFERENCES public.chemotherapy_cycle (chemotherapy_cycle_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_plan_order_copied_from FOREIGN KEY (copied_from_order_id)
        REFERENCES public.chemotherapy_plan_order (plan_order_id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_plan_order_plan ON public.chemotherapy_plan_order (chemotherapy_plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_order_encounter ON public.chemotherapy_plan_order (encounter_no);

ALTER TABLE public.chemotherapy_plan_order ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.chemotherapy_plan_order FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'CHEMOTHERAPY_PLAN_ORDER', 'CPOR', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'CHEMOTHERAPY_PLAN_ORDER');

-- Plan items: owning order + custom drug names (not in medicine_master).
ALTER TABLE public.chemotherapy_plan_items
    ADD COLUMN IF NOT EXISTS plan_order_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS drug_name     VARCHAR(200),
    ALTER COLUMN medicine_id DROP NOT NULL;

ALTER TABLE public.chemotherapy_plan_items
    DROP CONSTRAINT IF EXISTS fk_plan_items_order,
    DROP CONSTRAINT IF EXISTS chk_plan_items_drug;
ALTER TABLE public.chemotherapy_plan_items
    ADD CONSTRAINT fk_plan_items_order FOREIGN KEY (plan_order_id)
        REFERENCES public.chemotherapy_plan_order (plan_order_id) ON DELETE SET NULL ON UPDATE NO ACTION,
    ADD CONSTRAINT chk_plan_items_drug
        CHECK (medicine_id IS NOT NULL OR NULLIF(btrim(drug_name), '') IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_plan_items_order ON public.chemotherapy_plan_items (plan_order_id);

-- Hydration rows: owning order.
ALTER TABLE public.chemotherapy_plan_hydration
    ADD COLUMN IF NOT EXISTS plan_order_id VARCHAR(100);
ALTER TABLE public.chemotherapy_plan_hydration
    DROP CONSTRAINT IF EXISTS fk_plan_hydration_order;
ALTER TABLE public.chemotherapy_plan_hydration
    ADD CONSTRAINT fk_plan_hydration_order FOREIGN KEY (plan_order_id)
        REFERENCES public.chemotherapy_plan_order (plan_order_id) ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_plan_hydration_order ON public.chemotherapy_plan_hydration (plan_order_id);

-- Prescription items: custom drug names print as free text.
ALTER TABLE public.prescription_items
    ADD COLUMN IF NOT EXISTS drug_name VARCHAR(200),
    ALTER COLUMN medicine_id DROP NOT NULL;
ALTER TABLE public.prescription_items
    DROP CONSTRAINT IF EXISTS chk_prescription_items_drug;
ALTER TABLE public.prescription_items
    ADD CONSTRAINT chk_prescription_items_drug
        CHECK (medicine_id IS NOT NULL OR NULLIF(btrim(drug_name), '') IS NOT NULL);

-- One open (PLANNED / ACTIVE) chemotherapy plan per patient: a plan is one
-- course, closed by completing its last cycle day or by discontinue/cancel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_chemo_plan_per_patient
    ON public.chemotherapy_plan (patient_id)
    WHERE active_status = 1 AND treatment_status IN ('PLANNED', 'ACTIVE');

COMMIT;
