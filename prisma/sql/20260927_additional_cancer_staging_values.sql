-- Multi-type diagnosis: each additional cancer type keeps its own
-- laterality and T / N / M (one value each, same allowed sets as
-- oncology_staging_detail) instead of being comma-joined into the primary
-- row, which its CHECK constraints reject.

BEGIN;

ALTER TABLE public.oncology_staging_additional_cancers
    ADD COLUMN IF NOT EXISTS laterality VARCHAR(100),
    ADD COLUMN IF NOT EXISTS t_stage    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS n_stage    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS m_stage    VARCHAR(100);

ALTER TABLE public.oncology_staging_additional_cancers
    DROP CONSTRAINT IF EXISTS oncology_staging_additional_cancers_laterality_check,
    DROP CONSTRAINT IF EXISTS oncology_staging_additional_cancers_t_stage_check,
    DROP CONSTRAINT IF EXISTS oncology_staging_additional_cancers_n_stage_check,
    DROP CONSTRAINT IF EXISTS oncology_staging_additional_cancers_m_stage_check;

ALTER TABLE public.oncology_staging_additional_cancers
    ADD CONSTRAINT oncology_staging_additional_cancers_laterality_check
        CHECK (laterality IN ('Left', 'Right', 'Bilateral', 'NA')),
    ADD CONSTRAINT oncology_staging_additional_cancers_t_stage_check
        CHECK (t_stage IN ('Tx', 'T0', 'Tis', 'T1', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T3', 'T4', 'T4a', 'T4b', 'T4d')),
    ADD CONSTRAINT oncology_staging_additional_cancers_n_stage_check
        CHECK (n_stage IN ('Nx', 'N0', 'N1', 'N1mi', 'N2', 'N2a', 'N2b', 'N3', 'N3a', 'N3b', 'N3c')),
    ADD CONSTRAINT oncology_staging_additional_cancers_m_stage_check
        CHECK (m_stage IN ('M0', 'M1', 'M1a', 'M1b', 'M1c'));

COMMIT;
