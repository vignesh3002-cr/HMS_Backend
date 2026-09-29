-- Molecular Testing moves from Diagnosis (oncology_staging_detail) to the
-- Consultation tab > Patient Details, recorded per encounter like
-- Reports (Previous): test + date + result + impression.
--
-- Step 1 of 2 (non-breaking): create the table and copy the two existing
-- values. Step 2 (20260926_drop_staging_molecular_columns.sql) drops the old
-- oncology_staging_detail columns once the code no longer uses them.

BEGIN;

CREATE TABLE IF NOT EXISTS public.encounter_molecular_test (
    id                          BIGSERIAL PRIMARY KEY,
    encounter_molecular_test_id VARCHAR(100) NOT NULL,
    encounter_no                VARCHAR(100) NOT NULL,
    -- One of the listed molecular tests, or a test typed by hand.
    test_name                   VARCHAR(200) NOT NULL,
    test_date                   DATE,
    result                      TEXT,
    impression                  TEXT,
    created_at                  TIMESTAMP(6) DEFAULT now(),
    updated_at                  TIMESTAMP(6) DEFAULT now(),
    created_by                  VARCHAR(100),
    CONSTRAINT uq_encounter_molecular_test_id UNIQUE (encounter_molecular_test_id),
    CONSTRAINT fk_encounter_molecular_test_encounter FOREIGN KEY (encounter_no)
        REFERENCES public.encounter (encounter_no) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_encounter_molecular_test_encounter
    ON public.encounter_molecular_test (encounter_no);

-- One row per test per visit (the form upserts by test name).
CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_molecular_test_name
    ON public.encounter_molecular_test (encounter_no, lower(test_name));

ALTER TABLE public.encounter_molecular_test ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.encounter_molecular_test FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'ENCOUNTER_MOLECULAR_TEST', 'EMOL', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'ENCOUNTER_MOLECULAR_TEST');

-- Existing values, moved onto the visit when each diagnosis was last saved
-- (confirmed): STD330 (PAT017) -> ENC121, STD385 (PAT014) -> ENC124. The old
-- free-text note becomes the impression.
WITH moved AS (
    SELECT m.encounter_no,
           s.suggested_molecular_test      AS test_name,
           s.suggested_molecular_test_date AS test_date,
           s.suggested_molecular_test_note AS impression,
           s.updated_at
    FROM public.oncology_staging_detail s
    JOIN (VALUES ('STD330', 'ENC121'), ('STD385', 'ENC124')) AS m(staging_detail_id, encounter_no)
      ON m.staging_detail_id = s.staging_detail_id
    WHERE s.suggested_molecular_test IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.encounter_molecular_test t
          WHERE t.encounter_no = m.encounter_no
            AND lower(t.test_name) = lower(s.suggested_molecular_test)
      )
),
seq AS (
    SELECT current_number FROM public.id_sequences WHERE entity_name = 'ENCOUNTER_MOLECULAR_TEST'
),
numbered AS (
    SELECT moved.*, (SELECT current_number FROM seq) + row_number() OVER (ORDER BY moved.updated_at) AS n
    FROM moved
)
INSERT INTO public.encounter_molecular_test
    (encounter_molecular_test_id, encounter_no, test_name, test_date, impression, created_at, updated_at, created_by)
SELECT 'EMOL' || lpad(n::text, 7, '0'), encounter_no, test_name, test_date, impression, updated_at, updated_at, 'MIGRATION'
FROM numbered;

UPDATE public.id_sequences
SET current_number = GREATEST(current_number, (
        SELECT COALESCE(MAX(substring(encounter_molecular_test_id FROM 5)::int), 0)
        FROM public.encounter_molecular_test
    )),
    updated_at = now()
WHERE entity_name = 'ENCOUNTER_MOLECULAR_TEST';

COMMIT;
