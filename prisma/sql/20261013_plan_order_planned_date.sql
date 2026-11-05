-- Consultation > Chemotherapy Order: every cycle day has a planned date,
-- calculated from the plan's treatment start (Cycle 1 / Day 1 = start;
-- each next day +1, plus one rest day for a day without medicine; the
-- next cycle's Day 1 = the previous cycle's last day + the cycle interval
-- + 1 - see chemotherapy.schedule.ts). When the doctor moves a day's
-- Start Date, that day's date is kept here and overrides the calculated
-- one (only that day changes). NULL = the calculated date.

BEGIN;

ALTER TABLE public.chemotherapy_plan_order
    ADD COLUMN IF NOT EXISTS planned_date DATE;

COMMIT;
