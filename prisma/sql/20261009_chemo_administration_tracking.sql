-- Chemotherapy administration tracking per cycle day order.
--
-- A cycle day order now runs ORDERED (doctor drafting) -> IN_ADMINISTRATION
-- (consultation submitted; one PENDING administration row per medicine) ->
-- COMPLETED (every medicine GIVEN / SKIPPED / CANCELLED and the day was
-- completed from the patient's Administration tab). Rows recorded before
-- this change (no plan_order_id, free-text status) are left as they are.

BEGIN;

ALTER TABLE public.chemotherapy_plan_order
    DROP CONSTRAINT IF EXISTS chk_plan_order_status;
ALTER TABLE public.chemotherapy_plan_order
    ADD CONSTRAINT chk_plan_order_status
        CHECK (order_status IN ('ORDERED', 'IN_ADMINISTRATION', 'COMPLETED'));

-- The administration row's cycle day order and day, and why a medicine was
-- skipped / cancelled.
ALTER TABLE public.chemotherapy_administration
    ADD COLUMN IF NOT EXISTS plan_order_id      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS administration_day INT,
    ADD COLUMN IF NOT EXISTS status_reason      TEXT,
    ALTER COLUMN administration_status SET DEFAULT 'PENDING';

ALTER TABLE public.chemotherapy_administration
    DROP CONSTRAINT IF EXISTS fk_chemo_admin_plan_order,
    DROP CONSTRAINT IF EXISTS chk_chemo_admin_status,
    DROP CONSTRAINT IF EXISTS chk_chemo_admin_reason;
ALTER TABLE public.chemotherapy_administration
    ADD CONSTRAINT fk_chemo_admin_plan_order FOREIGN KEY (plan_order_id)
        REFERENCES public.chemotherapy_plan_order (plan_order_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    ADD CONSTRAINT chk_chemo_admin_status
        CHECK (plan_order_id IS NULL
            OR administration_status IN ('PENDING', 'GIVEN', 'SKIPPED', 'CANCELLED')),
    ADD CONSTRAINT chk_chemo_admin_reason
        CHECK (plan_order_id IS NULL
            OR administration_status NOT IN ('SKIPPED', 'CANCELLED')
            OR NULLIF(btrim(status_reason), '') IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_chemo_admin_plan_order
    ON public.chemotherapy_administration (plan_order_id);

-- One live row per medicine of a cycle day order. Partial, so the legacy
-- unlinked rows are untouched; Postgres has no partial UNIQUE constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_chemo_admin_order_item
    ON public.chemotherapy_administration (plan_order_id, chemotherapy_plan_item_id)
    WHERE active_status = 1 AND plan_order_id IS NOT NULL;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'CHEMOTHERAPY_ADMINISTRATION', 'CADM', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'CHEMOTHERAPY_ADMINISTRATION');

COMMIT;
