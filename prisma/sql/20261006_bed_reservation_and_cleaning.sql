-- IPD bed management: reservations, cleaning turnaround, cancel / no-show.
--
-- Bed lifecycle becomes
--   AVAILABLE -> RESERVED -> OCCUPIED -> CLEANING -> AVAILABLE   (+ MAINTENANCE)
-- bed_master.status is a free VARCHAR, so the two new values (RESERVED,
-- CLEANING) need no constraint change; this only adds the columns that go
-- with them.
--
--   bed_master.reserved_admission_id / reserved_until
--       Set only while a bed is RESERVED for a PLANNED admission. The nightly
--       pg_cron sweep (20261007_daily_sweeps_pg_cron.sql) returns the bed to
--       AVAILABLE once reserved_until has passed.
--
--   admission.cancellation_reason
--       Why a PLANNED admission was CANCELLED or became NO_SHOW (NO_SHOW is a
--       new admission.status value; also a free VARCHAR).
--
-- Apply after 20261005_admission_active_uniqueness.sql. Additive only.

BEGIN;

ALTER TABLE public.bed_master
    ADD COLUMN IF NOT EXISTS reserved_admission_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS reserved_until        TIMESTAMP(6);

ALTER TABLE public.admission
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- The expiry sweep looks up RESERVED beds by reserved_until.
CREATE INDEX IF NOT EXISTS idx_bed_reserved_until
    ON public.bed_master (reserved_until)
    WHERE status = 'RESERVED';

COMMIT;
