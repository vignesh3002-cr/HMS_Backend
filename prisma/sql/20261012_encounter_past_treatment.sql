-- Consultation > Past History: the doctor can now select more than one
-- previous Treatment Type, each with its own Date, Brief Note and Treatment
-- Response, stored per encounter in its own table (one row per treatment
-- type per visit), related to encounter.encounter_no. The single
-- encounter.past_history_treatment_* columns are backfilled into it.

BEGIN;

CREATE TABLE IF NOT EXISTS public.encounter_past_treatment (
    id                          BIGSERIAL PRIMARY KEY,
    encounter_past_treatment_id VARCHAR(100) NOT NULL,
    encounter_no                VARCHAR(100) NOT NULL,
    -- Code from treatment_type_master when the value is a master entry;
    -- NULL for an older free-text value.
    treatment_type_code         VARCHAR(100),
    -- The selected value as shown in the form.
    treatment_type              VARCHAR(100) NOT NULL,
    treatment_date              DATE,
    note                        TEXT,
    treatment_response          TEXT,
    created_at                  TIMESTAMP(6) DEFAULT now(),
    updated_at                  TIMESTAMP(6) DEFAULT now(),
    created_by                  VARCHAR(100),
    CONSTRAINT uq_encounter_past_treatment_id UNIQUE (encounter_past_treatment_id),
    CONSTRAINT fk_encounter_past_treatment_encounter FOREIGN KEY (encounter_no)
        REFERENCES public.encounter (encounter_no) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_encounter_past_treatment_encounter
    ON public.encounter_past_treatment (encounter_no);

-- One row per treatment type per visit (the form syncs by name).
CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_past_treatment_type
    ON public.encounter_past_treatment (encounter_no, lower(treatment_type));

ALTER TABLE public.encounter_past_treatment ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.encounter_past_treatment FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'ENCOUNTER_PAST_TREATMENT', 'EPTX', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'ENCOUNTER_PAST_TREATMENT');

-- Backfill: each encounter's single saved treatment becomes its first row.
WITH seq AS (
    SELECT prefix, current_number
    FROM public.id_sequences
    WHERE entity_name = 'ENCOUNTER_PAST_TREATMENT'
    FOR UPDATE
),
legacy AS (
    SELECT e.encounter_no,
           btrim(e.past_history_treatment_type) AS treatment_type,
           e.past_history_treatment_date,
           e.past_history_treatment_note,
           e.past_history_treatment_response,
           row_number() OVER (ORDER BY e.encounter_id) AS rn
    FROM public.encounter e
    WHERE btrim(coalesce(e.past_history_treatment_type, '')) <> ''
      AND NOT EXISTS (
          SELECT 1 FROM public.encounter_past_treatment p
          WHERE p.encounter_no = e.encounter_no
      )
),
inserted AS (
    INSERT INTO public.encounter_past_treatment (
        encounter_past_treatment_id, encounter_no, treatment_type_code,
        treatment_type, treatment_date, note, treatment_response, created_by
    )
    SELECT seq.prefix || lpad((seq.current_number + legacy.rn)::text, 7, '0'),
           legacy.encounter_no,
           (SELECT t.code FROM public.treatment_type_master t
             WHERE lower(t.name) = lower(legacy.treatment_type) LIMIT 1),
           left(legacy.treatment_type, 100),
           legacy.past_history_treatment_date::date,
           legacy.past_history_treatment_note,
           legacy.past_history_treatment_response,
           'SYSTEM'
    FROM legacy CROSS JOIN seq
    RETURNING 1
)
UPDATE public.id_sequences
SET current_number = current_number + (SELECT count(*) FROM inserted)
WHERE entity_name = 'ENCOUNTER_PAST_TREATMENT';

COMMIT;
