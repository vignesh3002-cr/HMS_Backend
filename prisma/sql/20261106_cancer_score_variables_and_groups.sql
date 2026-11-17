-- Diagnosis tab: Score Variables + Score Risk Groups master tables, and the
-- score result columns on oncology_staging_detail.
-- Source: EMR_Risk_Prognostic_Scores.xlsx (Score_Variables / Score_Groups).
-- Rows are seeded by prisma/seedCancerScores.ts (idempotent upsert).

BEGIN;

CREATE TABLE IF NOT EXISTS public.cancer_score_variable (
    id                BIGSERIAL PRIMARY KEY,
    score_variable_id VARCHAR(100) NOT NULL,
    score_id          VARCHAR(100) NOT NULL,
    variable_name     VARCHAR(200) NOT NULL,
    criterion         VARCHAR(500),
    points            VARCHAR(100),
    source            VARCHAR(20) NOT NULL,   -- REG, VIT, LAB, STG, IHC, GEN, DER, PATH, CLIN
    auto_filled       BOOLEAN NOT NULL DEFAULT FALSE,
    source_field      VARCHAR(200),
    display_order     INT NOT NULL DEFAULT 1,
    active_status     SMALLINT DEFAULT 1,
    created_at        TIMESTAMP(6) DEFAULT now(),
    updated_at        TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_score_variable_id UNIQUE (score_variable_id)
);

CREATE INDEX IF NOT EXISTS idx_score_variable_score ON public.cancer_score_variable (score_id);

CREATE TABLE IF NOT EXISTS public.cancer_score_group (
    id            BIGSERIAL PRIMARY KEY,
    score_group_id VARCHAR(100) NOT NULL,
    score_id      VARCHAR(100) NOT NULL,
    group_range   VARCHAR(200) NOT NULL,
    meaning       TEXT,
    sort_order    INT NOT NULL DEFAULT 1,
    active_status SMALLINT DEFAULT 1,
    CONSTRAINT uq_score_group_id UNIQUE (score_group_id)
);

CREATE INDEX IF NOT EXISTS idx_score_group_score ON public.cancer_score_group (score_id);

ALTER TABLE public.cancer_score_variable ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.cancer_score_variable FROM anon, authenticated, service_role;

ALTER TABLE public.cancer_score_group ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.cancer_score_group FROM anon, authenticated, service_role;

ALTER TABLE public.oncology_staging_detail
    ADD COLUMN IF NOT EXISTS score_variables JSON,
    ADD COLUMN IF NOT EXISTS score_result    TEXT,
    ADD COLUMN IF NOT EXISTS risk_group      VARCHAR(200),
    ADD COLUMN IF NOT EXISTS score_points    NUMERIC(10, 2);

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'SCORE_VARIABLE', 'SCVR', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'SCORE_VARIABLE');

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'SCORE_GROUP', 'SCGR', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'SCORE_GROUP');

COMMIT;
