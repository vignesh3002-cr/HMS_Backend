-- Consultation > Investigations / Scans: per-test testing Method, offered
-- only for lab tests whose lab_test_category is "Molecular" (Germline
-- Testing / Tissue Biopsy Testing / Liquid Biopsy Testing). Sent by
-- POST /lab-order-item and returned by GET /lab-order-item(/:id),
-- GET /lab-order/:id and /lab-report.

BEGIN;

ALTER TABLE public.lab_order_item
    ADD COLUMN IF NOT EXISTS method VARCHAR(100);

COMMIT;
