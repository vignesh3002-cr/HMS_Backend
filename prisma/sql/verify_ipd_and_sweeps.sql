-- READ-ONLY checks: which of the IPD / daily-sweep SQL files are applied?
-- Nothing here writes. Run it whole in the Supabase SQL editor; every row
-- reports one item as APPLIED or MISSING.

SELECT item, source_file, CASE WHEN ok THEN 'APPLIED' ELSE 'MISSING' END AS state
FROM (
    -- 20261005_admission_active_uniqueness.sql
    SELECT 'Unique index: one ADMITTED row per patient' AS item,
           '20261005_admission_active_uniqueness.sql' AS source_file,
           EXISTS (SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'public' AND indexname = 'uq_admission_patient_admitted') AS ok
    UNION ALL
    SELECT 'Unique index: one ADMITTED row per bed',
           '20261005_admission_active_uniqueness.sql',
           EXISTS (SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'public' AND indexname = 'uq_admission_bed_admitted')

    -- 20261006_bed_reservation_and_cleaning.sql --not working
    UNION ALL
    SELECT 'Column bed_master.reserved_admission_id',
           '20261006_bed_reservation_and_cleaning.sql',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'bed_master' AND column_name = 'reserved_admission_id')
    UNION ALL
    SELECT 'Column bed_master.reserved_until',
           '20261006_bed_reservation_and_cleaning.sql',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'bed_master' AND column_name = 'reserved_until')
    UNION ALL
    SELECT 'Column admission.cancellation_reason',
           '20261006_bed_reservation_and_cleaning.sql',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'admission' AND column_name = 'cancellation_reason')
    UNION ALL
    SELECT 'Index idx_bed_reserved_until',
           '20261006_bed_reservation_and_cleaning.sql',
           EXISTS (SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'public' AND indexname = 'idx_bed_reserved_until')

    -- 20261007_daily_sweeps_pg_cron.sql
    UNION ALL
    SELECT 'Extension pg_cron',
           '20261007_daily_sweeps_pg_cron.sql',
           EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    UNION ALL
    SELECT 'Index idx_appointment_pending_date',
           '20261007_daily_sweeps_pg_cron.sql',
           EXISTS (SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'public' AND indexname = 'idx_appointment_pending_date')
    UNION ALL
    SELECT 'Function hms_sweep_elapsed_appointments()',
           '20261007_daily_sweeps_pg_cron.sql',
           EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hms_sweep_elapsed_appointments')
    UNION ALL
    SELECT 'Function hms_sweep_ipd_daily()',
           '20261007_daily_sweeps_pg_cron.sql',
           EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hms_sweep_ipd_daily')
) checks
ORDER BY source_file, item;

-- The two cron jobs. pg_cron's own table only exists once the extension is
-- on -- if this errors with "relation cron.job does not exist", pg_cron is
-- not enabled yet (the row above will say MISSING too).
SELECT jobname, schedule, active
  FROM cron.job
 WHERE jobname IN ('hms-appointment-no-show', 'hms-ipd-daily-sweep');

-- Last runs of those jobs (empty until the first night after applying).
SELECT j.jobname, d.status, d.return_message, d.start_time
  FROM cron.job_run_details d
  JOIN cron.job j USING (jobid)
 WHERE j.jobname IN ('hms-appointment-no-show', 'hms-ipd-daily-sweep')
 ORDER BY d.start_time DESC
 LIMIT 10;
