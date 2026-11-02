-- Chemotherapy Order: Drug Name now sourced from generic_name on
-- chemotherapy_regimen_protocol_items (scoped by protocol_id) instead of
-- medicine_name from medicine_master.
--
-- Adds a nullable generic_name column to regimen-protocol items and backfills
-- existing rows from medicine_master.generic_name so legacy data keeps showing
-- a name instead of going blank.

BEGIN;

ALTER TABLE public.chemotherapy_regimen_protocol_items
    ADD COLUMN IF NOT EXISTS generic_name VARCHAR(255);

UPDATE public.chemotherapy_regimen_protocol_items i
SET generic_name = m.generic_name
FROM public.medicine_master m
WHERE m.medicine_id = i.medicine_id
  AND (i.generic_name IS NULL OR i.generic_name = '');

COMMIT;
