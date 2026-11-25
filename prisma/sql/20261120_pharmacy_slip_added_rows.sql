-- Pharmacy Slip popup: ADD / REMOVE rows.
--
-- The popup can now insert a copy of any medicine row (and remove rows). To
-- reopen a saved slip with exactly the rows the doctor left on screen, each
-- slip line records which draft row it came from and whether it is the
-- automatic top-up line. Rows the doctor removed are remembered on the slip
-- header so they are not rebuilt from the chemotherapy order on the next open.
--
-- All statements are idempotent so this file can be re-run safely.

BEGIN;

ALTER TABLE public.pharmacy_slip_item
    ADD COLUMN IF NOT EXISTS source_row_key   VARCHAR(160);

ALTER TABLE public.pharmacy_slip_item
    ADD COLUMN IF NOT EXISTS is_top_up        BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.pharmacy_slip_item
    ADD COLUMN IF NOT EXISTS extra_suppressed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.pharmacy_slip
    ADD COLUMN IF NOT EXISTS removed_row_keys JSONB;

COMMIT;
