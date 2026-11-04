-- Consultation > Treatment Plan > Line of Therapy.
--
-- New master table so doctors can pick First Line ... Fifth Line (seeded
-- below) and add custom values on the fly when a typed value is not in the
-- list. Mirrors immunization_master / treatment_type_master.
--
-- Run once against the application database before starting the new backend.

BEGIN;

CREATE TABLE IF NOT EXISTS public.line_of_therapy_master (
    id                BIGSERIAL    PRIMARY KEY,
    code              VARCHAR(100) NOT NULL UNIQUE,
    name              VARCHAR(100) NOT NULL,
    description       VARCHAR(200),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_line_of_therapy_active
    ON public.line_of_therapy_master (is_active);

-- Seed the standard lines of therapy.
INSERT INTO public.line_of_therapy_master (code, name, description, is_active, created_by, updated_by) VALUES
    ('LOT-FIRST-LINE',  'First Line',  'First line of therapy',  TRUE, 'SYSTEM', 'SYSTEM'),
    ('LOT-SECOND-LINE', 'Second Line', 'Second line of therapy', TRUE, 'SYSTEM', 'SYSTEM'),
    ('LOT-THIRD-LINE',  'Third Line',  'Third line of therapy',  TRUE, 'SYSTEM', 'SYSTEM'),
    ('LOT-FOURTH-LINE', 'Fourth Line', 'Fourth line of therapy', TRUE, 'SYSTEM', 'SYSTEM'),
    ('LOT-FIFTH-LINE',  'Fifth Line',  'Fifth line of therapy',  TRUE, 'SYSTEM', 'SYSTEM')
ON CONFLICT (code) DO NOTHING;

COMMIT;
