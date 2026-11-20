-- Per-branch timezone for the follow-up alert purge
-- (updates public.hms_purge_followup_alert_state() from 20261014_followup_alerts.sql,
--  which hardcoded 'Asia/Kolkata').
--
-- Marks belong to the branch where the patient was consulted, so "is this
-- mark older than follow_up_date + 40 days?" is judged against THAT branch's
-- calendar day (branch.timezone), not a single global zone. A missing/NULL
-- branch falls back to Asia/Kolkata; the 40-day margin makes the job purely
-- housekeeping, so its daily schedule is left as-is.

BEGIN;

CREATE OR REPLACE FUNCTION public.hms_purge_followup_alert_state()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    removed integer;
BEGIN
    DELETE FROM public.followup_alert_state s
    USING public.encounter e
    LEFT JOIN public.branch b ON b.branch_id = e.branch_id
    WHERE s.encounter_no = e.encounter_no
      AND s.follow_up_date < public.hms_local_date(
              now(), COALESCE(b.timezone, 'Asia/Kolkata')) - 40;

    GET DIAGNOSTICS removed = ROW_COUNT;
    RETURN removed;
END;
$$;

COMMIT;
