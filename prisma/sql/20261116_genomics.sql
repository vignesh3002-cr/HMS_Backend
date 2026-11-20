-- Genomic Data Capture (NGS reports) for the oncology EMR.
--
-- One report = one genomic_test row; each report holds many genomic_result
-- rows (one per gene). gene_master is the admin-maintained cancer-site to
-- gene lookup loaded from EMR_IHC_Genomics_Master.v2.xlsx (Gene_Master tab).
--
-- Patient documents are NOT duplicated here: report_document_id points at the
-- existing patient_document row (document_type = LAB_REPORT) that the
-- /api/patient-documents/upload endpoint already stores.
--
-- Audit rows reuse oncology_audit_log (entity_type = 'genomic_test').
-- Idempotent: safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    CREATE TYPE genomic_sample_type AS ENUM ('LIQUID_BIOPSY', 'TISSUE', 'GERMLINE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE genomic_scope AS ENUM ('SOMATIC', 'GERMLINE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE genomic_status AS ENUM ('PRESENT', 'ABSENT', 'VUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- gene_master - the lookup the dropdown is built from (never hard-coded)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gene_master (
    id             BIGSERIAL PRIMARY KEY,
    gene_master_id VARCHAR(100) NOT NULL,
    -- Genomics-site label shown in the NGS report dropdown, e.g. "Lung",
    -- "Gastric", "Leukaemia - AML".
    cancer_site    VARCHAR(150) NOT NULL,
    scope          genomic_scope NOT NULL,
    gene_symbol    VARCHAR(50) NOT NULL,
    sort_order     INTEGER NOT NULL DEFAULT 1,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    source         VARCHAR(100),
    -- The 2 Nov specification's site name this list maps to (null for lists
    -- proposed for cancer types that were not in that spec).
    spec_site      VARCHAR(150),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_gene_master_id UNIQUE (gene_master_id),
    CONSTRAINT uq_gene_master UNIQUE (cancer_site, scope, gene_symbol),
    CONSTRAINT ck_gene_master_symbol_upper
        CHECK (gene_symbol = upper(gene_symbol) AND gene_symbol !~ '\s')
);

CREATE INDEX IF NOT EXISTS idx_gene_master_site_scope
    ON public.gene_master (cancer_site, scope, active, sort_order);

-- ---------------------------------------------------------------------------
-- genomic_test - one NGS report
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.genomic_test (
    id                 BIGSERIAL PRIMARY KEY,
    test_id            VARCHAR(100) NOT NULL,
    patient_id         VARCHAR(100) NOT NULL,
    -- The visit the report was captured in. Kept even when the diagnosis has
    -- not been saved yet so the row can be relinked afterwards.
    encounter_no       VARCHAR(100),
    -- The diagnosis staging detail this report belongs to. Nullable: a report
    -- may be captured before the DIAGNOSIS section is saved, then relinked by
    -- the oncology service once the staging detail exists.
    staging_detail_id  VARCHAR(100),
    branch_id          VARCHAR(100),
    sample_type        genomic_sample_type NOT NULL,
    cancer_site        VARCHAR(150) NOT NULL,
    report_date        DATE NOT NULL,
    collection_date    DATE,
    lab_name           VARCHAR(200),
    panel_name         VARCHAR(200),
    -- patient_document.document_id of the uploaded report file.
    report_document_id VARCHAR(100),
    remarks            VARCHAR(1000),
    is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    delete_reason      VARCHAR(500),
    created_by         VARCHAR(100) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         VARCHAR(100),
    updated_at         TIMESTAMPTZ,
    CONSTRAINT uq_genomic_test_id UNIQUE (test_id),
    CONSTRAINT fk_genomic_test_staging FOREIGN KEY (staging_detail_id)
        REFERENCES public.oncology_staging_detail (staging_detail_id)
        ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT fk_genomic_test_encounter FOREIGN KEY (encounter_no)
        REFERENCES public.encounter (encounter_no)
        ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT fk_genomic_test_document FOREIGN KEY (report_document_id)
        REFERENCES public.patient_document (document_id)
        ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT ck_genomic_report_date_not_future CHECK (report_date <= CURRENT_DATE),
    CONSTRAINT ck_genomic_collection_before_report
        CHECK (collection_date IS NULL OR collection_date <= report_date),
    CONSTRAINT ck_genomic_delete_reason
        CHECK ((NOT is_deleted) OR (delete_reason IS NOT NULL AND length(btrim(delete_reason)) > 0))
);

CREATE INDEX IF NOT EXISTS idx_genomic_test_patient
    ON public.genomic_test (patient_id);
CREATE INDEX IF NOT EXISTS idx_genomic_test_staging
    ON public.genomic_test (staging_detail_id);
CREATE INDEX IF NOT EXISTS idx_genomic_test_encounter
    ON public.genomic_test (encounter_no);
CREATE INDEX IF NOT EXISTS idx_genomic_test_document
    ON public.genomic_test (report_document_id);

-- ---------------------------------------------------------------------------
-- genomic_result - one gene row per report
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.genomic_result (
    id                 BIGSERIAL PRIMARY KEY,
    result_id          VARCHAR(100) NOT NULL,
    test_id            VARCHAR(100) NOT NULL,
    gene_symbol        VARCHAR(50) NOT NULL,
    is_other_gene      BOOLEAN NOT NULL DEFAULT FALSE,
    status             genomic_status NOT NULL,
    transcript_details VARCHAR(500),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_genomic_result_id UNIQUE (result_id),
    CONSTRAINT uq_gene_per_test UNIQUE (test_id, gene_symbol),
    CONSTRAINT fk_genomic_result_test FOREIGN KEY (test_id)
        REFERENCES public.genomic_test (test_id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT ck_genomic_details_when_positive
        CHECK (status = 'ABSENT'
               OR (transcript_details IS NOT NULL AND length(btrim(transcript_details)) > 0)),
    CONSTRAINT ck_genomic_gene_upper
        CHECK (gene_symbol = upper(gene_symbol) AND gene_symbol !~ '\s')
);

CREATE INDEX IF NOT EXISTS idx_genomic_result_test
    ON public.genomic_result (test_id);

-- ---------------------------------------------------------------------------
-- Id sequences (same convention as every other generated id in the EMR)
-- ---------------------------------------------------------------------------
INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'GENOMIC_TEST', 'GT', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'GENOMIC_TEST');

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'GENOMIC_RESULT', 'GR', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'GENOMIC_RESULT');

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'GENE_MASTER', 'GM', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'GENE_MASTER');

COMMIT;
