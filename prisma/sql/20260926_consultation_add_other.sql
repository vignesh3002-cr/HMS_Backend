-- Consultation "Add other" values.
--  * General Examination: extra findings master + the findings ticked on an
--    encounter (the six core findings stay as their boolean columns).
--  * Past History > Treatment Type: master (was a hard-coded list).
--  * Reports (Previous) > Select Test: a test typed by hand is stored on the
--    patient's report row only (test_name) - lab_test_master is not changed.
-- Immunization / Drug Consumption already have masters (immunization_master,
-- drug_consumption_master) and a "custom" create endpoint.

BEGIN;

CREATE TABLE IF NOT EXISTS public.general_examination_master (
    id            BIGSERIAL PRIMARY KEY,
    code          VARCHAR(100) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    description   VARCHAR(200),
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP(6) NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP(6) NOT NULL DEFAULT now(),
    created_by    VARCHAR(100),
    updated_by    VARCHAR(100),
    CONSTRAINT uq_general_examination_code UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS idx_general_examination_active ON public.general_examination_master (is_active);

CREATE TABLE IF NOT EXISTS public.treatment_type_master (
    id            BIGSERIAL PRIMARY KEY,
    code          VARCHAR(100) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    description   VARCHAR(200),
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP(6) NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP(6) NOT NULL DEFAULT now(),
    created_by    VARCHAR(100),
    updated_by    VARCHAR(100),
    CONSTRAINT uq_treatment_type_code UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS idx_treatment_type_active ON public.treatment_type_master (is_active);

-- The list previously hard-coded in ConsultationStep.tsx ("Other" is
-- replaced by "+ Add").
INSERT INTO public.treatment_type_master (code, name, display_order) VALUES
    ('TRT-CHEMOTHERAPY', 'Chemotherapy', 1),
    ('TRT-RADIOTHERAPY', 'Radiotherapy', 2),
    ('TRT-SURGERY', 'Surgery', 3),
    ('TRT-IMMUNOTHERAPY', 'Immunotherapy', 4),
    ('TRT-TARGETED-THERAPY', 'Targeted Therapy', 5),
    ('TRT-HORMONE-THERAPY', 'Hormone Therapy', 6),
    ('TRT-BONE-MARROW-TRANSPLANT', 'Bone Marrow Transplant', 7)
ON CONFLICT (code) DO NOTHING;

-- Extra General Examination findings ticked on the encounter: [{code, name}].
ALTER TABLE public.encounter
    ADD COLUMN IF NOT EXISTS general_examination_others JSONB;

-- Previous report for a test that isn't in lab_test_master.
ALTER TABLE public.encounter_report
    ALTER COLUMN lab_test_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS test_name VARCHAR(200);

ALTER TABLE public.encounter_report
    DROP CONSTRAINT IF EXISTS chk_encounter_report_test;
ALTER TABLE public.encounter_report
    ADD CONSTRAINT chk_encounter_report_test
    CHECK (lab_test_id IS NOT NULL OR NULLIF(btrim(test_name), '') IS NOT NULL);

-- Match the other masters: RLS on, no anon/authenticated access (the backend
-- connects as the table owner).
ALTER TABLE public.general_examination_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_type_master ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.general_examination_master FROM anon, authenticated, service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.treatment_type_master FROM anon, authenticated, service_role;

COMMIT;
