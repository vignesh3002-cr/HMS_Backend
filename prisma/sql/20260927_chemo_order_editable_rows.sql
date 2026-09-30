-- Chemotherapy Order: every column of every sub-tab row is editable and
-- saved on the patient's plan.
--  * Admin Instructions edit the plan item's administration fields; timing
--    and administration detail had no plan-item column yet.
--  * Hydration rows were read-only protocol template rows; the plan now
--    keeps its own copy once they are edited (the template is untouched).

BEGIN;

ALTER TABLE public.chemotherapy_plan_items
    ADD COLUMN IF NOT EXISTS timing_relative_to_primary VARCHAR(100),
    ADD COLUMN IF NOT EXISTS administration_detail      TEXT;

CREATE TABLE IF NOT EXISTS public.chemotherapy_plan_hydration (
    id                    BIGSERIAL PRIMARY KEY,
    plan_hydration_id     VARCHAR(100) NOT NULL,
    chemotherapy_plan_id  VARCHAR(100) NOT NULL,
    -- chemotherapy_protocol_dilutions row it started from, if any.
    source_dilution_id    VARCHAR(100),
    hydration_stage       VARCHAR(20) NOT NULL,
    agent_name            VARCHAR(200),
    diluent               VARCHAR(200),
    dilution_volume       NUMERIC(10, 2),
    dilution_volume_unit  VARCHAR(50),
    guidance              TEXT,
    display_order         INT NOT NULL DEFAULT 0,
    created_at            TIMESTAMP(6) DEFAULT now(),
    created_by            VARCHAR(100),
    CONSTRAINT uq_plan_hydration_id UNIQUE (plan_hydration_id),
    CONSTRAINT chk_plan_hydration_stage CHECK (hydration_stage IN ('PRE', 'POST')),
    CONSTRAINT fk_plan_hydration_plan FOREIGN KEY (chemotherapy_plan_id)
        REFERENCES public.chemotherapy_plan (chemotherapy_plan_id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_plan_hydration_plan ON public.chemotherapy_plan_hydration (chemotherapy_plan_id);

ALTER TABLE public.chemotherapy_plan_hydration ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.chemotherapy_plan_hydration FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'CHEMOTHERAPY_PLAN_HYDRATION', 'CPHY', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'CHEMOTHERAPY_PLAN_HYDRATION');

COMMIT;
