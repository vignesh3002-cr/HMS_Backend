-- Discharge type master: the Discharge Type dropdown's options, shared by
-- the whole hospital. "Others" + free text adds a row here (id from
-- id_sequences, DISCHARGE_TYPE -> DST0001...). Seeded with the 5 built-in
-- types so existing admissions keep matching. type_code is what
-- admission.discharge_type stores.

BEGIN;

CREATE TABLE IF NOT EXISTS public.discharge_type_master (
    id                BIGSERIAL PRIMARY KEY,
    discharge_type_id VARCHAR(100) NOT NULL,
    type_code         VARCHAR(100) NOT NULL,
    type_name         VARCHAR(100) NOT NULL,
    display_order     INT DEFAULT 1,
    active_status     SMALLINT DEFAULT 1,
    created_by        VARCHAR(100),
    created_at        TIMESTAMP(6) DEFAULT now(),
    updated_at        TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_discharge_type_id UNIQUE (discharge_type_id),
    CONSTRAINT uq_discharge_type_code UNIQUE (type_code)
);

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
VALUES ('DISCHARGE_TYPE', 'DST', 0)
ON CONFLICT (entity_name) DO NOTHING;

WITH seed(code, name, ord) AS (VALUES
    ('RECOVERED', 'Recovered', 1),
    ('AGAINST_MEDICAL_ADVICE', 'Against Medical Advice', 2),
    ('REFERRED_OUT', 'Referred Out', 3),
    ('DECEASED', 'Deceased', 4),
    ('DAYCARE_RELEASED', 'Daycare Released', 5)
), missing AS (
    SELECT s.*, row_number() OVER (ORDER BY s.ord) AS rn
    FROM seed s
    WHERE NOT EXISTS (SELECT 1 FROM public.discharge_type_master m WHERE m.type_code = s.code)
), seq AS (
    UPDATE public.id_sequences
    SET current_number = current_number + (SELECT count(*) FROM missing), updated_at = now()
    WHERE entity_name = 'DISCHARGE_TYPE'
    RETURNING current_number - (SELECT count(*) FROM missing) AS base
)
INSERT INTO public.discharge_type_master (discharge_type_id, type_code, type_name, display_order, created_by)
SELECT 'DST' || lpad((seq.base + missing.rn)::text, 4, '0'), missing.code, missing.name, missing.ord, 'SYSTEM_SEED'
FROM missing, seq;

-- Same RLS posture as the other reference masters (server uses the owner role).
ALTER TABLE public.discharge_type_master ENABLE ROW LEVEL SECURITY;

COMMIT;
