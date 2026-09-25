-- Diagnosis tab: Score master + Date of Progression / Date of Relapse.
-- Source: EMR_Oncology_Master_Data_Spec.docx, Section 2 "Grade and Score
-- Input Fields". Rows are seeded by prisma/seedCancerScores.ts.
-- Date of Diagnosis reuses the existing oncology_staging_detail.diagnosis_date.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cancer_score (
    id               BIGSERIAL PRIMARY KEY,
    score_id         VARCHAR(100) NOT NULL,
    cancer_type_id   VARCHAR(100) NOT NULL,
    score_system     VARCHAR(150) NOT NULL,
    score_value      VARCHAR(150) NOT NULL,
    input_type       VARCHAR(50),
    score_rule       TEXT,
    -- Spec's original "Cancer Type" label (e.g. "DLBCL / Aggressive NHL").
    applies_to       VARCHAR(150),
    -- Optional "|"-separated histopathology keywords; when set, the score is
    -- only offered once a matching subtype is selected in the Diagnosis tab.
    subtype_keywords VARCHAR(255),
    display_order    INT DEFAULT 1,
    active_status    SMALLINT DEFAULT 1,
    created_at       TIMESTAMP(6) DEFAULT now(),
    updated_at       TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_cancer_score_id UNIQUE (score_id),
    CONSTRAINT uq_cancer_score_value UNIQUE (cancer_type_id, score_system, score_value),
    CONSTRAINT fk_cancer_score_cancer_type FOREIGN KEY (cancer_type_id)
        REFERENCES public.cancer_types (cancer_type_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_cancer_score_type ON public.cancer_score (cancer_type_id);

-- Match the other oncology masters: RLS on, no anon/authenticated access
-- (the backend connects as the table owner).
ALTER TABLE public.cancer_score ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.cancer_score FROM anon, authenticated, service_role;

ALTER TABLE public.oncology_staging_detail
    ADD COLUMN IF NOT EXISTS progression_date DATE,
    ADD COLUMN IF NOT EXISTS relapse_date     DATE,
    ADD COLUMN IF NOT EXISTS score            TEXT,
    ADD COLUMN IF NOT EXISTS score_system     VARCHAR(255);

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'CANCER_SCORE', 'SCST', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'CANCER_SCORE');

COMMIT;
