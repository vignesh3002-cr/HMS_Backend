-- TNM Staging Module (developer spec, Nov 2026).
--
-- Master tables hold the published staging tables (schemas, T/N/M categories,
-- stage-group rules, direct-stage lists, condition criteria). They are seeded
-- from EMR_Master_IHC_Genomics_TNM.xlsx via prisma/seedStagingMaster.ts and are
-- read-only at runtime.
--
-- oncology_stage_record is the per-visit transaction table: one row per
-- (staging detail x schema x context), with history kept by deactivating the
-- previous row instead of overwriting it. The legacy text columns on
-- oncology_staging_detail (clinical_stage / t_stage / n_stage / m_stage) are
-- still written by the service so existing printouts and chemotherapy
-- validation keep working unchanged.
--
-- p16 / p40 are added to ihc_results because the HPV-oropharynx (S04/S02) and
-- oesophageal SCC (S14) schema suggestions depend on them and no column
-- existed before.
--
-- Idempotent: safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- Master: staging systems / editions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging_schema (
  id                 BIGSERIAL PRIMARY KEY,
  schema_id          VARCHAR(10)  NOT NULL UNIQUE,
  schema_name        VARCHAR(250) NOT NULL,
  system             VARCHAR(100),
  edition            VARCHAR(150),
  status             VARCHAR(150),
  mode               VARCHAR(10)  NOT NULL DEFAULT 'TNM',
  extra_inputs       TEXT,
  note               TEXT,
  cancer_types_using TEXT,
  display_order      INT,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMP(6) NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Master: cancer type -> schema (Primary / Sub-site / Additional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging_map (
  id                  BIGSERIAL PRIMARY KEY,
  map_id              VARCHAR(20)  NOT NULL UNIQUE,
  cancer_type_id      VARCHAR(100) NOT NULL,
  cancer_type_label   VARCHAR(200) NOT NULL,
  schema_id           VARCHAR(10)  NOT NULL,
  role                VARCHAR(20)  NOT NULL,
  schema_name         VARCHAR(250),
  system_edition      VARCHAR(200),
  subsite_question    TEXT,
  auto_select_rule    TEXT,
  note                TEXT,
  display_order       INT,
  created_at          TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staging_map_type_schema_role
  ON staging_map (cancer_type_id, schema_id, role);
CREATE INDEX IF NOT EXISTS idx_staging_map_type
  ON staging_map (cancer_type_id);

-- ---------------------------------------------------------------------------
-- Master: T / N / M / S options per schema and context
--   shown_code is what the clinician sees (cN1), rule_code is what the
--   stage rules match on (N1).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging_category (
  id            BIGSERIAL PRIMARY KEY,
  category_id   VARCHAR(20) NOT NULL UNIQUE,
  schema_id     VARCHAR(10) NOT NULL,
  axis          VARCHAR(1)  NOT NULL,
  shown_code    VARCHAR(50) NOT NULL,
  rule_code     VARCHAR(50) NOT NULL,
  context       VARCHAR(20) NOT NULL DEFAULT 'both',
  definition    TEXT,
  display_order INT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staging_category
  ON staging_category (schema_id, axis, shown_code, context);
CREATE INDEX IF NOT EXISTS idx_staging_category_lookup
  ON staging_category (schema_id, axis);

-- ---------------------------------------------------------------------------
-- Master: stage-group rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage_rule (
  id             BIGSERIAL PRIMARY KEY,
  rule_id        VARCHAR(20) NOT NULL UNIQUE,
  schema_id      VARCHAR(10) NOT NULL,
  context        VARCHAR(20) NOT NULL DEFAULT 'both',
  stage_group    VARCHAR(50) NOT NULL,
  t_codes        TEXT[]      NOT NULL DEFAULT '{}',
  n_codes        TEXT[]      NOT NULL DEFAULT '{}',
  m_codes        TEXT[]      NOT NULL DEFAULT '{}',
  conditions_raw TEXT,
  conditions     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  criteria_text  TEXT,
  flag           TEXT,
  display_order  INT
);

CREATE INDEX IF NOT EXISTS idx_stage_rule_lookup
  ON stage_rule (schema_id, context);

-- ---------------------------------------------------------------------------
-- Master: direct (non-TNM) stage lists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS direct_stage (
  id             BIGSERIAL PRIMARY KEY,
  direct_stage_id VARCHAR(20) NOT NULL UNIQUE,
  schema_id      VARCHAR(10) NOT NULL,
  stage_code     VARCHAR(50) NOT NULL,
  definition     TEXT,
  display_order  INT,
  flag           TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_direct_stage
  ON direct_stage (schema_id, stage_code);

-- ---------------------------------------------------------------------------
-- Master: rule condition criteria (Age, PSA, GG, S, Grade, Site, Mitosis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging_criterion (
  criterion_key  VARCHAR(50) PRIMARY KEY,
  label          VARCHAR(120) NOT NULL,
  input_type     VARCHAR(20)  NOT NULL,
  options        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  unit           VARCHAR(50),
  source_module  VARCHAR(20),
  display_order  INT
);

-- ---------------------------------------------------------------------------
-- Transaction: one stage record per staging detail x schema x context
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oncology_stage_record (
  id               BIGSERIAL PRIMARY KEY,
  stage_record_id  VARCHAR(100) NOT NULL UNIQUE,
  staging_detail_id VARCHAR(100) NOT NULL,
  diagnosis_id     VARCHAR(100),
  patient_id       VARCHAR(100) NOT NULL,
  cancer_type_id   VARCHAR(100) NOT NULL,
  schema_id        VARCHAR(10)  NOT NULL,
  schema_role      VARCHAR(20)  NOT NULL DEFAULT 'PRIMARY',
  system           VARCHAR(100),
  edition          VARCHAR(150),
  context          VARCHAR(20)  NOT NULL,
  mode             VARCHAR(10)  NOT NULL DEFAULT 'TNM',
  t_code           VARCHAR(50),
  n_code           VARCHAR(50),
  m_code           VARCHAR(50),
  s_code           VARCHAR(50),
  t_display        VARCHAR(50),
  n_display        VARCHAR(50),
  m_display        VARCHAR(50),
  conditions       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  modifiers        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  derived_stage    VARCHAR(50),
  derived_rule_id  VARCHAR(20),
  final_stage      VARCHAR(50)  NOT NULL,
  is_overridden    BOOLEAN      NOT NULL DEFAULT FALSE,
  override_reason  TEXT,
  stage_date       DATE,
  notes            TEXT,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by       VARCHAR(100),
  created_at       TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_by       VARCHAR(100),
  updated_at       TIMESTAMP(6) NOT NULL DEFAULT now()
);

-- Exactly one live record per diagnosis visit, cancer type, schema and
-- context. History is kept as is_active = false rows, so an old stage is
-- never overwritten. Two selected cancer types can both record a clinical
-- stage (even when they happen to share a schema), so the cancer type is
-- part of the key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_record_active
  ON oncology_stage_record (staging_detail_id, cancer_type_id, schema_id, context)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_stage_record_detail
  ON oncology_stage_record (staging_detail_id);
CREATE INDEX IF NOT EXISTS idx_stage_record_patient
  ON oncology_stage_record (patient_id, stage_date DESC);
CREATE INDEX IF NOT EXISTS idx_stage_record_cancer
  ON oncology_stage_record (cancer_type_id, schema_id);

-- ---------------------------------------------------------------------------
-- IHC: p16 / p40 (HPV and squamous-cell schema suggestions)
-- ---------------------------------------------------------------------------
ALTER TABLE ihc_results
  ADD COLUMN IF NOT EXISTS p16_status  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS p16_percent SMALLINT,
  ADD COLUMN IF NOT EXISTS p40_status  VARCHAR(100);

-- ID sequence for oncology_stage_record.stage_record_id (SGR0001...).
INSERT INTO id_sequences (entity_name, prefix, current_number)
VALUES ('STAGE_RECORD', 'SGR', 0)
ON CONFLICT (entity_name) DO NOTHING;

COMMIT;
