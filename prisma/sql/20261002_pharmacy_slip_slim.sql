-- Pharmacy slip slim-down.
--
-- The doctor-facing slip is four columns: Medicine Name, Dose + Unit, Type, Qty.
-- Everything that only existed to feed wider forms is dropped, and the slip is
-- resolved from a chemotherapy plan only (plan_order_id already carries that
-- link, so the source registry was redundant).
--
-- Quantity becomes whole packs (INT) and the Issue step disappears: printing the
-- slip is what finalises it, so DRAFT -> ISSUED now happens on the first print
-- rather than on a separate issue endpoint. The ISSUED status and its
-- "ISSUED implies issued_at" constraint both stay.

BEGIN;

-- --------------------------------------------------- header: drop unused cols
ALTER TABLE public.pharmacy_slip
    DROP COLUMN IF EXISTS source_type,
    DROP COLUMN IF EXISTS source_ref,
    DROP COLUMN IF EXISTS remarks,
    DROP COLUMN IF EXISTS active_status;

DROP INDEX IF EXISTS public.idx_pharmacy_slip_source;

-- ------------------------------------------------------ lines: drop unused cols
ALTER TABLE public.pharmacy_slip_item
    DROP COLUMN IF EXISTS quantity_unit,
    DROP COLUMN IF EXISTS source_item_ref,
    DROP COLUMN IF EXISTS item_status,
    DROP COLUMN IF EXISTS remarks,
    DROP COLUMN IF EXISTS is_narcotic,
    DROP COLUMN IF EXISTS is_high_risk,
    DROP COLUMN IF EXISTS is_batch_required,
    DROP COLUMN IF EXISTS is_expiry_required,
    DROP COLUMN IF EXISTS batch_no,
    DROP COLUMN IF EXISTS expiry_date;

ALTER TABLE public.pharmacy_slip_item
    DROP CONSTRAINT IF EXISTS chk_pharmacy_slip_item_status;

-- ------------------------------- quantity: NUMERIC(10,2) -> whole packs (INT)
-- Rounds first so a half-pack from the old decimal column does not abort the
-- ALTER on Postgres 17's numeric -> int cast.
ALTER TABLE public.pharmacy_slip_item
    ALTER COLUMN quantity TYPE INTEGER
    USING CASE WHEN quantity IS NULL THEN NULL ELSE ROUND(quantity)::INTEGER END;

-- --------------------------- drug_name: generate from medicine_master.medicine_id
-- drug_name used to be written only for free-typed "Others" drugs, which left
-- every catalog line with a blank name on the slip. It is now the display name
-- for every line: backfilled from the catalog, and stored (not generated on
-- read) so printing a slip cannot rewrite the name of an already dispensed one.
UPDATE public.pharmacy_slip_item i
   SET drug_name = m.medicine_name
  FROM public.medicine_master m
 WHERE i.medicine_id = m.medicine_id
   AND NULLIF(btrim(i.drug_name), '') IS NULL;

COMMIT;