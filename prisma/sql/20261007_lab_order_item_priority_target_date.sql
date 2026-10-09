-- Consultation > Investigations / Scans: per-test clinical notes, priority
-- and target date. Sent by POST /lab-order-item and returned by
-- GET /lab-order-item(/:id), GET /lab-order/:id and /lab-report.
-- (remarks is not reused: barcode generation overwrites it.)

BEGIN;

ALTER TABLE public.lab_order_item
    ADD COLUMN IF NOT EXISTS clinical_notes TEXT,
    ADD COLUMN IF NOT EXISTS priority       VARCHAR(100) DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS target_date    DATE;

COMMIT;
