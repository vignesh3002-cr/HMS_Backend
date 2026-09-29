-- Diagnosis with more than one cancer type.
-- oncology_staging_detail keeps the primary cancer_type_id / cancer_subtype_id;
-- every other cancer type selected in the Diagnosis step is stored here, with
-- the histopathology ticked under it (optional). Chemotherapy protocols are
-- validated against the primary + these cancers.

BEGIN;

CREATE TABLE IF NOT EXISTS public.oncology_staging_additional_cancers (
    id                BIGSERIAL PRIMARY KEY,
    staging_detail_id VARCHAR(100) NOT NULL,
    cancer_type_id    VARCHAR(100) NOT NULL,
    cancer_subtype_id VARCHAR(100),
    display_order     INT DEFAULT 1,
    created_at        TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_staging_additional_cancer UNIQUE (staging_detail_id, cancer_type_id),
    CONSTRAINT fk_staging_additional_cancer_staging FOREIGN KEY (staging_detail_id)
        REFERENCES public.oncology_staging_detail (staging_detail_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_staging_additional_cancer_type FOREIGN KEY (cancer_type_id)
        REFERENCES public.cancer_types (cancer_type_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_staging_additional_cancer_subtype FOREIGN KEY (cancer_subtype_id)
        REFERENCES public.cancer_subtypes (subtype_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_staging_additional_cancer_staging
    ON public.oncology_staging_additional_cancers (staging_detail_id);

-- Match the other oncology tables: RLS on, no anon/authenticated access
-- (the backend connects as the table owner).
ALTER TABLE public.oncology_staging_additional_cancers ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.oncology_staging_additional_cancers FROM anon, authenticated, service_role;

COMMIT;
