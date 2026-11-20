-- Per-branch timezone for the daily day-boundary sweeps (replaces
-- 20261007_daily_sweeps_pg_cron.sql, which hardcoded 'Asia/Kolkata').
--
-- Each branch now gets its OWN calendar day boundary:
--
--   appointment_date < today-in-branch-zone   -> NO_SHOW
--   admission_date  < start-of-today-in-zone  -> NO_SHOW (+ release held bed)
--
-- so a New York branch flips at New York midnight while a Chennai branch
-- flips at Indian midnight - never one global zone for every hospital.
--
-- Safety:
--   * COALESCE(branch.timezone, 'Asia/Kolkata') covers a NULL/missing branch
--     row, so an orphaned appointment still sweeps (never silently skipped).
--   * hms_local_date()/hms_today_start_utc() catch an unrecognised zone name
--     and fall back to Asia/Kolkata instead of aborting the whole job.
--   * Jobs now run HOURLY ('35 * * * *', pg_cron is UTC) instead of once at
--     18:35 UTC: every branch's local midnight is caught within 60 minutes,
--     including zones with unusual DST transitions at 00:00. Each sweep is
--     idempotent (it only matches still-pending statuses) and partial-index
--     indexed, so hourly cost stays negligible.
--
-- Re-running this file is safe: helpers/functions are replaced and the two
-- jobs are unscheduled before being rescheduled.
--
-- Verify afterwards:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'hms-%';
--   SELECT j.jobname, d.status, d.start_time FROM cron.job_run_details d
--     JOIN cron.job j USING (jobid) WHERE j.jobname LIKE 'hms-%'
--    ORDER BY d.start_time DESC LIMIT 20;

BEGIN;

-- Safe "what calendar day is `ts` in `tz`?" - falls back rather than raising
-- if a zone name is somehow invalid.
CREATE OR REPLACE FUNCTION public.hms_local_date(ts timestamptz, tz text)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN (ts AT TIME ZONE tz)::date;
EXCEPTION WHEN OTHERS THEN
    RETURN (ts AT TIME ZONE 'Asia/Kolkata')::date;
END;
$$;

-- Start of the current calendar day in `tz`, expressed as the naive UTC
-- timestamp that Prisma writes into admission_date / reserved_until.
CREATE OR REPLACE FUNCTION public.hms_today_start_utc(tz text)
RETURNS timestamp
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN (date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz)
               AT TIME ZONE 'UTC';
EXCEPTION WHEN OTHERS THEN
    RETURN (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'UTC';
END;
$$;

-- ------------------------------------------------------------ appointments
-- SCHEDULED / RESCHEDULED appointments whose day has passed IN THEIR OWN
-- BRANCH'S TIMEZONE -> NO_SHOW. CHECKED_IN / IN_CONSULTATION and terminal
-- statuses are never touched.
CREATE OR REPLACE FUNCTION public.hms_sweep_elapsed_appointments()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    affected integer;
BEGIN
    UPDATE public.appointment_history a
       SET status = 'NO_SHOW',
           notification_status = 'NOT_REQUIRED'
     WHERE a.status IN ('SCHEDULED', 'RESCHEDULED')
       AND a.appointment_date < public.hms_local_date(
               now(),
               COALESCE(
                   (SELECT b.timezone FROM public.branch b
                     WHERE b.branch_id = a.branch_id),
                   'Asia/Kolkata'));

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;

-- -------------------------------------------------------------------- IPD
-- PLANNED admissions whose planned day (in their branch's zone) has passed
-- -> NO_SHOW and any bed they held -> AVAILABLE; then lapsed reservations.
CREATE OR REPLACE FUNCTION public.hms_sweep_ipd_daily()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    now_utc timestamp := now() AT TIME ZONE 'UTC';
    no_shows integer;
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
               AND a.admission_date < public.hms_today_start_utc(COALESCE(
                       (SELECT br.timezone FROM public.branch br
                         WHERE br.branch_id = a.branch_id),
                       'Asia/Kolkata'))
       );

    -- 2. PLANNED admissions whose planned (branch-local) day has passed.
    --    Keyed on the planned admission_date, never on created_at.
    UPDATE public.admission a
       SET status = 'NO_SHOW',
           cancellation_reason = 'Not admitted on the planned date',
           updated_by = 'SYSTEM',
           updated_at = now_utc
     WHERE a.status = 'PLANNED'
       AND a.admission_date < public.hms_today_start_utc(COALESCE(
               (SELECT br.timezone FROM public.branch br
                 WHERE br.branch_id = a.branch_id),
               'Asia/Kolkata'));

    GET DIAGNOSTICS no_shows = ROW_COUNT;

    -- 3. Any other reservation whose hold has lapsed - an absolute instant,
    --    so it needs no timezone at all.
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

-- Hourly (UTC): catches every branch's local midnight within the hour.
SELECT cron.schedule('hms-appointment-no-show', '35 * * * *', 'SELECT public.hms_sweep_elapsed_appointments()');
SELECT cron.schedule('hms-ipd-daily-sweep',     '36 * * * *', 'SELECT public.hms_sweep_ipd_daily()');

COMMIT;

-- Optional one-off runs (each returns how many rows it moved):
--   SELECT public.hms_sweep_elapsed_appointments();
--   SELECT public.hms_sweep_ipd_daily();
