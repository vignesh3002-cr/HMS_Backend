-- One active admission per patient, one active admission per bed.
--
-- The IPD service already checks both under row locks (patient row + bed row,
-- SELECT ... FOR UPDATE), but those checks only protect code paths that take
-- the locks. These partial unique indexes make the database itself refuse a
-- second ADMITTED row for the same patient or the same bed, whatever writes
-- it. PLANNED / DISCHARGED / CANCELLED rows are unaffected, so a patient can
-- still have any number of past admissions and planned requests.
--
-- schema.prisma declares the same two indexes on model admission (partialIndexes
-- preview, where: raw(...)), so a db pull stays in sync. A violation surfaces
-- in Prisma as P2002, which IpdService maps back to a readable message.

BEGIN;

-- Refuse to run (instead of failing halfway) if live data already breaks the
-- rule; those rows have to be resolved by hand first. To list them:
--   SELECT patient_id, array_agg(ip_number) FROM public.admission
--    WHERE status = 'ADMITTED' GROUP BY patient_id HAVING count(*) > 1;
--   SELECT bed_id, array_agg(ip_number) FROM public.admission
--    WHERE status = 'ADMITTED' AND bed_id IS NOT NULL GROUP BY bed_id HAVING count(*) > 1;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.admission
         WHERE status = 'ADMITTED'
         GROUP BY patient_id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Some patients have more than one ADMITTED admission -- resolve them before applying this migration';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.admission
         WHERE status = 'ADMITTED' AND bed_id IS NOT NULL
         GROUP BY bed_id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Some beds have more than one ADMITTED admission -- resolve them before applying this migration';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_patient_admitted
    ON public.admission (patient_id)
    WHERE status = 'ADMITTED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_bed_admitted
    ON public.admission (bed_id)
    WHERE status = 'ADMITTED' AND bed_id IS NOT NULL;

COMMIT;
