-- Diagnosis step: the exact form selections behind a staging detail (per
-- cancer type Stage / Body Site / Grade / Score, the doctor's wording of
-- picked values, metastasis sites, ...). The text columns join those across
-- cancer types, so they can't be mapped back; the Diagnosis step reads this
-- (GET /oncology/staging-details/:id) to prefill the form from the latest
-- staging detail. Written by POST / PUT /oncology/staging-details.

BEGIN;

ALTER TABLE public.oncology_staging_detail
    ADD COLUMN IF NOT EXISTS form_state JSONB;

COMMIT;
