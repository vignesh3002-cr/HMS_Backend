-- Patient Details > Administration > "Add Adverse": an adverse event is now
-- recorded against the exact cycle day it happened on, not just the cycle.
-- plan_order_id points at that day's chemotherapy_plan_order row and
-- cycle_day keeps its day number. Both stay NULL for older rows, which only
-- carry chemotherapy_cycle_id.

BEGIN;

ALTER TABLE public.chemotherapy_adverse_event
    ADD COLUMN IF NOT EXISTS plan_order_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cycle_day     INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_chemo_adverse_plan_order'
    ) THEN
        ALTER TABLE public.chemotherapy_adverse_event
            ADD CONSTRAINT fk_chemo_adverse_plan_order FOREIGN KEY (plan_order_id)
            REFERENCES public.chemotherapy_plan_order (plan_order_id)
            ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chemo_adverse_cycle
    ON public.chemotherapy_adverse_event (chemotherapy_cycle_id);

CREATE INDEX IF NOT EXISTS idx_chemo_adverse_plan_order
    ON public.chemotherapy_adverse_event (plan_order_id);

COMMIT;
