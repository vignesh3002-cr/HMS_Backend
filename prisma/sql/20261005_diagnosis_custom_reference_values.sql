-- Diagnosis tab: doctors add the Disease Status / Body Site /
-- Histopathology / Cancer Stage / Grade / Score / T / N / M values a
-- dropdown doesn't list. Each value is stored in its master table (per
-- cancer type, except Disease Status which is one global list):
--   disease_status_master   NEW  the Disease Status values (the 6 the
--                                screen hardcoded, plus added ones)
--   tnm_stage_master        NEW  T / N / M values added per cancer type,
--                                on top of the AJCC values the backend knows
--   created_by              on the existing masters, set only on rows a
--                           doctor added (seeded rows stay NULL)
-- The fixed T / N / M CHECK lists are dropped: the backend now accepts an
-- AJCC value or one of the cancer type's tnm_stage_master values.

BEGIN;

-- ------------------------------------------ created_by on the masters
ALTER TABLE public.anatomical_site_master ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE public.cancer_grade_master    ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE public.cancer_score           ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE public.cancer_subtypes        ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE public.staging_reference      ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

-- ------------------------------------------- disease_status_master
CREATE TABLE IF NOT EXISTS public.disease_status_master (
    id                BIGSERIAL PRIMARY KEY,
    disease_status_id VARCHAR(100) NOT NULL,
    status_name       VARCHAR(100) NOT NULL,
    display_order     INT DEFAULT 1,
    active_status     SMALLINT DEFAULT 1,
    created_by        VARCHAR(100),
    created_at        TIMESTAMP(6) DEFAULT now(),
    updated_at        TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_disease_status_id UNIQUE (disease_status_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_disease_status_name
    ON public.disease_status_master (lower(status_name));

ALTER TABLE public.disease_status_master ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.disease_status_master FROM anon, authenticated, service_role;

INSERT INTO public.disease_status_master (disease_status_id, status_name, display_order, active_status)
SELECT v.disease_status_id, v.status_name, v.display_order, 1
  FROM (VALUES
    ('DSM0001', 'Newly Diagnosed', 1),
    ('DSM0002', 'In Remission', 2),
    ('DSM0003', 'Recurrence', 3),
    ('DSM0004', 'Progressive', 4),
    ('DSM0005', 'Stable', 5),
    ('DSM0006', 'Metastatic', 6)
  ) AS v (disease_status_id, status_name, display_order)
 WHERE NOT EXISTS (
    SELECT 1 FROM public.disease_status_master d
     WHERE d.disease_status_id = v.disease_status_id OR lower(d.status_name) = lower(v.status_name)
 );

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'DISEASE_STATUS', 'DSM', 6
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'DISEASE_STATUS');

-- ------------------------------------------------ tnm_stage_master
CREATE TABLE IF NOT EXISTS public.tnm_stage_master (
    id             BIGSERIAL PRIMARY KEY,
    tnm_id         VARCHAR(100) NOT NULL,
    cancer_type_id VARCHAR(100) NOT NULL,
    -- Which of the three the value belongs to.
    axis           VARCHAR(1) NOT NULL,
    stage_value    VARCHAR(100) NOT NULL,
    display_order  INT DEFAULT 1,
    active_status  SMALLINT DEFAULT 1,
    created_by     VARCHAR(100),
    created_at     TIMESTAMP(6) DEFAULT now(),
    updated_at     TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_tnm_stage_id UNIQUE (tnm_id),
    CONSTRAINT chk_tnm_stage_axis CHECK (axis IN ('T', 'N', 'M')),
    CONSTRAINT fk_tnm_stage_cancer_type FOREIGN KEY (cancer_type_id)
        REFERENCES public.cancer_types (cancer_type_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tnm_stage_value
    ON public.tnm_stage_master (cancer_type_id, axis, lower(stage_value));
CREATE INDEX IF NOT EXISTS idx_tnm_stage_type ON public.tnm_stage_master (cancer_type_id);

ALTER TABLE public.tnm_stage_master ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.tnm_stage_master FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'TNM_STAGE', 'TNM', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'TNM_STAGE');

-- ------------------------------- T / N / M: no fixed CHECK value lists
ALTER TABLE public.oncology_staging_detail
    DROP CONSTRAINT IF EXISTS oncology_staging_detail_t_stage_check,
    DROP CONSTRAINT IF EXISTS oncology_staging_detail_n_stage_check,
    DROP CONSTRAINT IF EXISTS oncology_staging_detail_m_stage_check;

ALTER TABLE public.oncology_staging_additional_cancers
    DROP CONSTRAINT IF EXISTS oncology_staging_additional_cancers_t_stage_check,
    DROP CONSTRAINT IF EXISTS oncology_staging_additional_cancers_n_stage_check,
    DROP CONSTRAINT IF EXISTS oncology_staging_additional_cancers_m_stage_check;

COMMIT;
