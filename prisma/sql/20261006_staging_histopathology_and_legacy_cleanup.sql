-- Diagnosis tab: the doctor may reword a picked value for this patient only
-- (masters unchanged). The text columns (clinical_stage, site, grade, score,
-- disease_status, t/n/m_stage) take the edited wording as is; Histopathology
-- is a cancer_subtypes FK, so its edited wording gets its own column, set
-- only when the doctor changed it (NULL = the subtype's name).
--
-- Also removes the legacy duplicate staging rows saved before one row per
-- visit (encounter_no NULL): only those whose visit day already has the
-- patient's linked row and that no chemotherapy plan points at. The rows
-- that are a day's only record, or a plan's staging detail, are kept.

BEGIN;

ALTER TABLE public.oncology_staging_detail
    ADD COLUMN IF NOT EXISTS histopathology VARCHAR(100);

ALTER TABLE public.oncology_staging_additional_cancers
    ADD COLUMN IF NOT EXISTS histopathology VARCHAR(100);

-- ------------------------------------------ legacy duplicate cleanup
CREATE TEMP TABLE legacy_duplicate_staging ON COMMIT DROP AS
SELECT s.staging_detail_id
  FROM public.oncology_staging_detail s
 WHERE s.encounter_no IS NULL
   AND NOT EXISTS (
        SELECT 1 FROM public.chemotherapy_plan p
         WHERE p.staging_detail_id = s.staging_detail_id
   )
   AND EXISTS (
        SELECT 1
          FROM public.encounter e
          JOIN public.oncology_staging_detail linked ON linked.encounter_no = e.encounter_no
         WHERE e.patient_id = s.patient_id
           AND e.encounter_ts::date = COALESCE(s.visit_date, s.created_at::date)
   );

DELETE FROM public.derived_fields
 WHERE staging_detail_id IN (SELECT staging_detail_id FROM legacy_duplicate_staging);
DELETE FROM public.ihc_results
 WHERE staging_detail_id IN (SELECT staging_detail_id FROM legacy_duplicate_staging);
DELETE FROM public.molecular_results
 WHERE staging_detail_id IN (SELECT staging_detail_id FROM legacy_duplicate_staging);
UPDATE public.patient_investigation_result SET staging_detail_id = NULL
 WHERE staging_detail_id IN (SELECT staging_detail_id FROM legacy_duplicate_staging);
-- oncology_staging_additional_cancers rows go with ON DELETE CASCADE.
DELETE FROM public.oncology_staging_detail
 WHERE staging_detail_id IN (SELECT staging_detail_id FROM legacy_duplicate_staging);

COMMIT;
