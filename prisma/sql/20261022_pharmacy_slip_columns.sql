-- Add protocol_dose column to pharmacy_slip_item
BEGIN;

ALTER TABLE public.pharmacy_slip_item
    ADD COLUMN IF NOT EXISTS protocol_dose VARCHAR(100);

COMMIT;

