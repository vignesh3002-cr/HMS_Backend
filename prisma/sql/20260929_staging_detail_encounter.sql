-- One oncology staging detail per visit: each row is linked to the
-- encounter (consultation visit) it was recorded in. Re-saving the
-- Diagnosis step in the same visit updates that visit's row; a new visit
-- gets a new row, so the patient's visit history keeps every visit's
-- diagnosis, notes and disease status.

BEGIN;

ALTER TABLE public.oncology_staging_detail
    ADD COLUMN IF NOT EXISTS encounter_no VARCHAR(100);

ALTER TABLE public.oncology_staging_detail
    DROP CONSTRAINT IF EXISTS fk_staging_encounter;
ALTER TABLE public.oncology_staging_detail
    ADD CONSTRAINT fk_staging_encounter FOREIGN KEY (encounter_no)
        REFERENCES public.encounter (encounter_no) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_staging_detail_encounter
    ON public.oncology_staging_detail (encounter_no);

-- Backfill: a row whose visit date (else save date) matches exactly one
-- encounter of the patient on that day belongs to that encounter. When
-- several rows map to one encounter only the most recently updated is
-- linked; the rest stay NULL and remain listed as their own visits.
WITH candidates AS (
    SELECT s.staging_detail_id,
           s.updated_at,
           (SELECT array_agg(e.encounter_no)
              FROM public.encounter e
             WHERE e.patient_id = s.patient_id
               AND e.encounter_ts::date = COALESCE(s.visit_date, s.created_at::date)) AS encounters
      FROM public.oncology_staging_detail s
     WHERE s.encounter_no IS NULL
), single AS (
    SELECT staging_detail_id, updated_at, encounters[1] AS encounter_no
      FROM candidates
     WHERE cardinality(encounters) = 1
), ranked AS (
    SELECT staging_detail_id,
           encounter_no,
           row_number() OVER (
               PARTITION BY encounter_no
               ORDER BY updated_at DESC NULLS LAST, staging_detail_id DESC
           ) AS rn
      FROM single
)
UPDATE public.oncology_staging_detail s
   SET encounter_no = r.encounter_no
  FROM ranked r
 WHERE r.staging_detail_id = s.staging_detail_id
   AND r.rn = 1
   AND NOT EXISTS (
       SELECT 1 FROM public.oncology_staging_detail o WHERE o.encounter_no = r.encounter_no
   );

-- One staging detail per visit (several cancers of one visit live in
-- oncology_staging_additional_cancers).
CREATE UNIQUE INDEX IF NOT EXISTS uq_staging_detail_encounter
    ON public.oncology_staging_detail (encounter_no)
    WHERE encounter_no IS NOT NULL;

COMMIT;
