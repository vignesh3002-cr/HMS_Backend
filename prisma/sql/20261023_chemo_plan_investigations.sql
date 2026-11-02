-- Consultation > Chemotherapy Order > Investigations.
--
-- Stores the baseline lab / non-lab / tissue investigations suggested for a
-- single chemotherapy cycle-day order. Rows are replaced as a set whenever the
-- doctor adds, edits, deletes, or accepts the defaults. investigations_saved on
-- chemotherapy_plan_order prevents deleted suggestions from being re-derived on
-- the next load. Additive only.

BEGIN;

ALTER TABLE public.chemotherapy_plan_order
    ADD COLUMN IF NOT EXISTS investigations_saved BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.chemotherapy_plan_order_investigation (
    id                     BIGSERIAL PRIMARY KEY,
    investigation_id       VARCHAR(100) NOT NULL,
    plan_order_id          VARCHAR(100) NOT NULL,
    chemotherapy_plan_id   VARCHAR(100) NOT NULL,
    lab_test_id            VARCHAR(100),
    investigation_name     VARCHAR(200) NOT NULL,
    investigation_category VARCHAR(20)  NOT NULL,
    investigation_type     VARCHAR(100),
    source_medicine_ids    VARCHAR(500),
    source_drug_names      VARCHAR(500),
    source_test_text       VARCHAR(300),
    monitoring_phase       VARCHAR(50)  DEFAULT 'BASELINE',
    priority               VARCHAR(20)  DEFAULT 'Normal',
    target_date            DATE,
    clinical_notes         TEXT,
    item_status            VARCHAR(20)  DEFAULT 'PLANNED',
    lab_order_id           VARCHAR(100),
    lab_order_item_id      VARCHAR(100),
    display_order          INT          NOT NULL DEFAULT 0,
    normalized_key         VARCHAR(220) NOT NULL,
    created_by             VARCHAR(100),
    created_at             TIMESTAMP(6) DEFAULT now(),
    updated_by             VARCHAR(100),
    updated_at             TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_plan_investigation_id UNIQUE (investigation_id),
    CONSTRAINT uq_plan_investigation_key UNIQUE (plan_order_id, normalized_key),
    CONSTRAINT chk_plan_investigation_category
        CHECK (investigation_category IN ('LAB', 'NON_LAB', 'TISSUE')),
    CONSTRAINT chk_plan_investigation_status
        CHECK (item_status IN ('PLANNED', 'ORDERED', 'CANCELLED')),
    CONSTRAINT fk_plan_investigation_order FOREIGN KEY (plan_order_id)
        REFERENCES public.chemotherapy_plan_order (plan_order_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_plan_investigation_plan FOREIGN KEY (chemotherapy_plan_id)
        REFERENCES public.chemotherapy_plan (chemotherapy_plan_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_plan_investigation_lab_test FOREIGN KEY (lab_test_id)
        REFERENCES public.lab_test_master (lab_test_id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_plan_investigation_plan
    ON public.chemotherapy_plan_order_investigation (chemotherapy_plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_investigation_order
    ON public.chemotherapy_plan_order_investigation (plan_order_id);

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'CHEMOTHERAPY_PLAN_INVESTIGATION', 'CPINV', 0
WHERE NOT EXISTS (
    SELECT 1 FROM public.id_sequences WHERE entity_name = 'CHEMOTHERAPY_PLAN_INVESTIGATION'
);

COMMIT;
