-- Follow-up due alerts: a visit's encounter.follow_up_date raises an alert
-- (to book the follow-up appointment) for the staff of the branch where
-- the patient was consulted - from the day before the date until 30 days
-- after it. The alerts themselves are calculated from the encounter, so
-- they disappear on their own; only each user's read / dismissed marks are
-- kept here, and a daily sweep removes marks that are long past.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_encounter_follow_up_date
    ON public.encounter (follow_up_date)
    WHERE follow_up_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.followup_alert_state (
    id             BIGSERIAL PRIMARY KEY,
    user_id        VARCHAR(100) NOT NULL,
    encounter_no   VARCHAR(100) NOT NULL,
    -- The follow-up date the mark was made for: a re-scheduled date alerts again.
    follow_up_date DATE         NOT NULL,
    read_at        TIMESTAMP(6),
    dismissed_at   TIMESTAMP(6),
    created_at     TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_followup_alert_state UNIQUE (user_id, encounter_no, follow_up_date),
    CONSTRAINT fk_followup_alert_state_encounter FOREIGN KEY (encounter_no)
        REFERENCES public.encounter (encounter_no) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_followup_alert_state_user
    ON public.followup_alert_state (user_id);

ALTER TABLE public.followup_alert_state ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.followup_alert_state FROM anon, authenticated, service_role;

-- Marks of alerts that ended (30 days after the follow-up date) are no
-- longer needed; keep a 10-day margin.
CREATE OR REPLACE FUNCTION public.hms_purge_followup_alert_state()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    today_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    removed   integer;
BEGIN
    DELETE FROM public.followup_alert_state
    WHERE follow_up_date < today_ist - 40;
    GET DIAGNOSTICS removed = ROW_COUNT;
    RETURN removed;
END;
$$;

COMMIT;

-- Daily at 00:07 IST (18:37 UTC), after the other sweeps. Re-runnable.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'hms-followup-alert-purge';
        PERFORM cron.schedule('hms-followup-alert-purge', '37 18 * * *', 'SELECT public.hms_purge_followup_alert_state()');
    END IF;
END $$;
