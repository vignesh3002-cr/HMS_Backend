-- Chemotherapy Order "Post Chemo Instructions" / "Additional Notes", saved
-- with the cycle day order (PUT /chemotherapy/plans/:planId/orders/:cycle/:day,
-- read back on plan_orders / current_order / GET .../orders/:cycle/:day) and
-- shown by the consultation Summary step + its print.

BEGIN;

ALTER TABLE public.chemotherapy_plan_order
    ADD COLUMN IF NOT EXISTS chemo_instructions TEXT,
    ADD COLUMN IF NOT EXISTS additional_notes   TEXT;

COMMIT;
