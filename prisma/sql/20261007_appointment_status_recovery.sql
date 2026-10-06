-- One-off repair of appointment statuses overwritten by the old in-app job.
--
-- From commit 970fd53 (2026-09-18) until it was removed, the job set EVERY
-- appointment dated before today to NO_SHOW every 5 minutes, whatever its
-- status -- so completed, cancelled and checked-in visits all read NO_SHOW.
-- The original status can be rebuilt from data the job never touched:
--
--   encounter CLOSED, or checkout_time set  -> COMPLETED
--   cancelled_at set                        -> CANCELLED
--   encounter still OPEN, or checkin_time   -> CHECKED_IN  (CHECKED_IN and
--                                              IN_CONSULTATION can't be told
--                                              apart; both mean "came in")
--   none of the above                       -> stays NO_SHOW (genuine no-show)
--
-- Not recoverable automatically: RESCHEDULE_REQUIRED / TRANSFER_REVIEW_REQUIRED
-- flags and the old notification_status. Step 1 lists appointments with a
-- PENDING reschedule-queue entry so those can be reviewed by hand.
--
-- Run the steps one at a time.

-- ------------------------------------------------- Step 1: preview (read-only)
WITH proposal AS (
    SELECT a.appointment_id,
           CASE
               WHEN e.status = 'CLOSED' OR a.checkout_time IS NOT NULL THEN 'COMPLETED'
               WHEN a.cancelled_at IS NOT NULL                          THEN 'CANCELLED'
               WHEN e.encounter_no IS NOT NULL OR a.checkin_time IS NOT NULL THEN 'CHECKED_IN'
               ELSE 'NO_SHOW'
           END AS restored_status,
           EXISTS (
               SELECT 1 FROM public.appointment_reschedule_queue q
                WHERE q.appointment_id = a.appointment_id AND q.status = 'PENDING'
           ) AS pending_reschedule
      FROM public.appointment_history a
      LEFT JOIN public.encounter e ON e.appointment_id = a.appointment_id
     WHERE a.status = 'NO_SHOW'
)
SELECT restored_status, pending_reschedule, count(*) AS appointments
  FROM proposal
 GROUP BY restored_status, pending_reschedule
 ORDER BY restored_status, pending_reschedule;

-- --------------------------------------------- Step 2: backup current status
CREATE TABLE IF NOT EXISTS public._backup_appointment_status_20261007 AS
SELECT appointment_id, status, notification_status, now() AS backed_up_at
  FROM public.appointment_history;

-- ------------------------------------------------------------ Step 3: repair
BEGIN;

WITH proposal AS (
    SELECT a.appointment_id,
           CASE
               WHEN e.status = 'CLOSED' OR a.checkout_time IS NOT NULL THEN 'COMPLETED'
               WHEN a.cancelled_at IS NOT NULL                          THEN 'CANCELLED'
               WHEN e.encounter_no IS NOT NULL OR a.checkin_time IS NOT NULL THEN 'CHECKED_IN'
               ELSE 'NO_SHOW'
           END AS restored_status
      FROM public.appointment_history a
      LEFT JOIN public.encounter e ON e.appointment_id = a.appointment_id
     WHERE a.status = 'NO_SHOW'
)
UPDATE public.appointment_history a
   SET status = p.restored_status
  FROM proposal p
 WHERE a.appointment_id = p.appointment_id
   AND p.restored_status <> 'NO_SHOW';

-- Check the counts match Step 1, then COMMIT (or ROLLBACK to undo).
COMMIT;

-- ------------------------------------------------ To undo after committing:
--   UPDATE public.appointment_history a
--      SET status = b.status, notification_status = b.notification_status
--     FROM public._backup_appointment_status_20261007 b
--    WHERE a.appointment_id = b.appointment_id;
-- Drop the backup table once you are satisfied:
--   DROP TABLE public._backup_appointment_status_20261007;
