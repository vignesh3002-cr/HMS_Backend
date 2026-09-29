-- Step 2 of 2: Molecular Testing now lives in encounter_molecular_test
-- (see 20260926_encounter_molecular_test.sql). Drop the old
-- oncology_staging_detail columns - but only if every value in them was
-- moved (a value saved from the Diagnosis tab after step 1 aborts this).

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.oncology_staging_detail s
        WHERE (s.suggested_molecular_test IS NOT NULL
               OR s.suggested_molecular_test_note IS NOT NULL
               OR s.suggested_molecular_test_date IS NOT NULL)
          AND NOT EXISTS (
              SELECT 1
              FROM public.encounter_molecular_test t
              JOIN (VALUES ('STD330', 'ENC121'), ('STD385', 'ENC124')) AS m(staging_detail_id, encounter_no)
                ON m.encounter_no = t.encounter_no
              WHERE m.staging_detail_id = s.staging_detail_id
                AND lower(t.test_name) = lower(s.suggested_molecular_test)
                AND t.test_date IS NOT DISTINCT FROM s.suggested_molecular_test_date
                AND t.impression IS NOT DISTINCT FROM s.suggested_molecular_test_note
          )
    ) THEN
        RAISE EXCEPTION 'oncology_staging_detail has Molecular Testing values that were not moved to encounter_molecular_test; not dropping the columns';
    END IF;
END $$;

ALTER TABLE public.oncology_staging_detail
    DROP COLUMN IF EXISTS suggested_molecular_test,
    DROP COLUMN IF EXISTS suggested_molecular_test_note,
    DROP COLUMN IF EXISTS suggested_molecular_test_date;

COMMIT;
