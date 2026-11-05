-- Consultation > Personal History > Immunization: each selected immunization
-- now records a Date and a Response, stored per encounter in its own table
-- (one row per immunization per visit), related to encounter.encounter_no.
-- The encounter's selected immunization names stay in
-- patient_personal_history.immunization; this table only carries the details.

BEGIN;

CREATE TABLE IF NOT EXISTS public.encounter_immunization (
    id                        BIGSERIAL PRIMARY KEY,
    encounter_immunization_id VARCHAR(100) NOT NULL,
    encounter_no              VARCHAR(100) NOT NULL,
    -- Code from immunization_master when the value is a master entry; NULL
    -- when the value is a free-text "Others" entry.
    immunization_code         VARCHAR(100),
    -- The selected value as shown in the form (master name or typed text).
    immunization_name         VARCHAR(100) NOT NULL,
    immunization_date         DATE,
    response                  TEXT,
    created_at                TIMESTAMP(6) DEFAULT now(),
    updated_at                TIMESTAMP(6) DEFAULT now(),
    created_by                VARCHAR(100),
    CONSTRAINT uq_encounter_immunization_id UNIQUE (encounter_immunization_id),
    CONSTRAINT fk_encounter_immunization_encounter FOREIGN KEY (encounter_no)
        REFERENCES public.encounter (encounter_no) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_encounter_immunization_encounter
    ON public.encounter_immunization (encounter_no);

-- One row per immunization per visit (the form syncs by name).
CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_immunization_name
    ON public.encounter_immunization (encounter_no, lower(immunization_name));

ALTER TABLE public.encounter_immunization ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.encounter_immunization FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'ENCOUNTER_IMMUNIZATION', 'EIMM', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'ENCOUNTER_IMMUNIZATION');

COMMIT;
