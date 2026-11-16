-- Score workspace: catalogue metadata + many-to-many cancer-type mapping.
-- Additive only. Existing columns and data are left untouched.

ALTER TABLE cancer_score
  ADD COLUMN IF NOT EXISTS purpose          TEXT,
  ADD COLUMN IF NOT EXISTS when_to_record   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS score_range      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS risk_groups      TEXT,
  ADD COLUMN IF NOT EXISTS score_status     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS score_reference  TEXT,
  ADD COLUMN IF NOT EXISTS developer_note   TEXT,
  ADD COLUMN IF NOT EXISTS auto_fill_percent VARCHAR(20);

-- A score can belong to several cancer types (e.g. MMR/MSI applies to eight).
CREATE TABLE IF NOT EXISTS cancer_score_cancer_types (
  id             BIGSERIAL PRIMARY KEY,
  score_id       VARCHAR(100) NOT NULL,
  cancer_type_id VARCHAR(100) NOT NULL,
  created_at     TIMESTAMP(6) DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_score_cancer_type
  ON cancer_score_cancer_types (score_id, cancer_type_id);

CREATE INDEX IF NOT EXISTS idx_score_cancer_type_type
  ON cancer_score_cancer_types (cancer_type_id);
