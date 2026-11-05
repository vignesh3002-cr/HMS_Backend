-- Daily day-boundary sweeps, run inside Postgres by pg_cron.
--
-- Replaces the two in-app jobs that polled every 5 minutes
-- (src/jobs/appointment-status.job.ts and src/jobs/ipd-bed.job.ts, both
-- removed). Every rule here only changes at an IST day boundary, so one run
-- just after IST midnight does all the work: no polling, no app involvement,
-- nothing sent back to the app (no egress), and it survives app restarts.
--
--   hms-appointment-no-show  00:05 IST  SCHEDULED / RESCHEDULED appointments
--                                       whose day has passed -> NO_SHOW.
--                                       CHECKED_IN / IN_CONSULTATION and all
--                                       terminal statuses are never touched.
--   hms-ipd-daily-sweep      00:06 IST  PLANNED admissions whose planned day
--                                       has passed -> NO_SHOW (and any bed
--                                       they held -> AVAILABLE); lapsed bed
--                                       reservations -> AVAILABLE.
--
-- pg_cron schedules are in UTC: 00:05 IST = 18:35 UTC.
--
-- Supabase: pg_cron can also be enabled from Dashboard -> Integrations -> Cron.
-- After applying, check runs with:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'hms-%';
--   SELECT j.jobname, d.status, d.return_message, d.start_time
--     FROM cron.job_run_details d JOIN cron.job j USING (jobid)
--    WHERE j.jobname LIKE 'hms-%' ORDER BY d.start_time DESC LIMIT 20;
--
-- Re-running this file is safe: functions are replaced and the two jobs are
-- unscheduled before being scheduled again.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The appointment sweep only ever looks at still-pending appointments, so it
-- reads a small slice of the table instead of scanning (and rewriting) every
-- past row.
CREATE INDEX IF NOT EXISTS idx_appointment_pending_date
    ON public.appointment_history (appointment_date)
    WHERE status IN ('SCHEDULED', 'RESCHEDULED');

-- ------------------------------------------------------------ appointments
CREATE OR REPLACE FUNCTION public.hms_sweep_elapsed_appointments()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    -- appointment_date is a DATE; "today" is the IST calendar day.
    today_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    affected  integer;
BEGIN
    UPDATE public.appointment_history
       SET status = 'NO_SHOW',
           notification_status = 'NOT_REQUIRED'
     WHERE status IN ('SCHEDULED', 'RESCHEDULED')
       AND appointment_date < today_ist;

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;

-- -------------------------------------------------------------------- IPD
CREATE OR REPLACE FUNCTION public.hms_sweep_ipd_daily()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    -- admission_date / reserved_until are TIMESTAMP (no tz) holding UTC, as
    -- Prisma writes them. Start of today in IST, expressed the same way:
    today_start_utc timestamp :=
        (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'UTC';
    now_utc         timestamp := now() AT TIME ZONE 'UTC';
    no_shows        integer;
BEGIN
    -- 1. Beds held for planned admissions that are about to become NO_SHOW.
    UPDATE public.bed_master b
       SET status = 'AVAILABLE',
           reserved_admission_id = NULL,
           reserved_until = NULL,
           updated_by = 'SYSTEM',
           updated_at = now_utc
     WHERE b.status = 'RESERVED'
       AND b.reserved_admission_id IN (
            SELECT a.admission_id
              FROM public.admission a
             WHERE a.status = 'PLANNED'
               AND a.admission_date < today_start_utc
       );

    -- 2. PLANNED admissions whose planned (IST) day has passed. Keyed on the
    --    planned admission_date, never on created_at.
    UPDATE public.admission
       SET status = 'NO_SHOW',
           cancellation_reason = 'Not admitted on the planned date',
           updated_by = 'SYSTEM',
           updated_at = now_utc
     WHERE status = 'PLANNED'
       AND admission_date < today_start_utc;

    GET DIAGNOSTICS no_shows = ROW_COUNT;

    -- 3. Any other reservation whose hold has lapsed.
    UPDATE public.bed_master
       SET status = 'AVAILABLE',
           reserved_admission_id = NULL,
           reserved_until = NULL,
           updated_by = 'SYSTEM',
           updated_at = now_utc
     WHERE status = 'RESERVED'
       AND reserved_until < now_utc;

    RETURN no_shows;
END;
$$;

-- --------------------------------------------------------------- schedule
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname IN ('hms-appointment-no-show', 'hms-ipd-daily-sweep');

SELECT cron.schedule('hms-appointment-no-show', '35 18 * * *', 'SELECT public.hms_sweep_elapsed_appointments()');
SELECT cron.schedule('hms-ipd-daily-sweep',     '36 18 * * *', 'SELECT public.hms_sweep_ipd_daily()');

COMMIT;

-- Optional: run both once now instead of waiting for tonight. Each returns
-- how many rows it moved to NO_SHOW. Run 20261007_appointment_status_recovery.sql
-- first if you are repairing appointment history.
--   SELECT public.hms_sweep_elapsed_appointments();
--   SELECT public.hms_sweep_ipd_daily();
