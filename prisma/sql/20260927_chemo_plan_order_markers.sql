-- Chemotherapy Order reload markers on the plan:
--  * order_day: the protocol day the plan's items were saved for from the
--    Chemotherapy Order screen - that day shows the saved rows (even none),
--    other days show the protocol template.
--  * hydration_saved: the plan's own hydration list (possibly empty) was
--    saved, so it replaces the protocol template.
-- Both are cleared when the plan switches protocol.

BEGIN;

ALTER TABLE public.chemotherapy_plan
    ADD COLUMN IF NOT EXISTS order_day       INT,
    ADD COLUMN IF NOT EXISTS hydration_saved BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
