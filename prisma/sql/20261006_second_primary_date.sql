-- Diagnosis tab: Date of Second Primary, recorded beside Date of Relapse
-- on the visit's oncology_staging_detail row (POST /oncology/staging-details
-- and PUT /oncology/staging-details/:stagingDetailId read it as
-- second_primary_date).

BEGIN;

ALTER TABLE public.oncology_staging_detail
    ADD COLUMN IF NOT EXISTS second_primary_date DATE;

COMMIT;
