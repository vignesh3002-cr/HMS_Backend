-- Part B of 20260928_chemo_cycle_day_orders.sql: a plan's saved orders now live
-- per cycle + day in chemotherapy_plan_order (with its own hydration_saved),
-- so the plan-level markers of the single saved order are dropped. Apply
-- after the code that no longer reads or writes them is deployed.

BEGIN;

ALTER TABLE public.chemotherapy_plan
    DROP COLUMN IF EXISTS order_day,
    DROP COLUMN IF EXISTS hydration_saved;

COMMIT;
