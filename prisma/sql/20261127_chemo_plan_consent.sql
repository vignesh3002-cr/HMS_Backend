-- Plan-scoped chemotherapy consent.
--
-- Uploaded signed consent forms now belong to one planned chemotherapy course
-- (patient_document.chemotherapy_plan_id) instead of only the visit. The
-- captured e-signatures live in chemotherapy_plan_consent, one row per plan,
-- so a later visit of the same plan can reload and print them and a new plan
-- starts with no inherited consent.
--
-- All statements are idempotent so this file can be re-run safely.

BEGIN;

ALTER TABLE public.patient_document
    ADD COLUMN IF NOT EXISTS chemotherapy_plan_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_patient_document_chemotherapy_plan
    ON public.patient_document (chemotherapy_plan_id);

CREATE INDEX IF NOT EXISTS idx_patient_document_patient_type
    ON public.patient_document (patient_id, document_type);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_patient_document_chemo_plan'
    ) THEN
        ALTER TABLE public.patient_document
            ADD CONSTRAINT fk_patient_document_chemo_plan
            FOREIGN KEY (chemotherapy_plan_id)
            REFERENCES public.chemotherapy_plan (chemotherapy_plan_id)
            ON DELETE SET NULL
            ON UPDATE NO ACTION;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.chemotherapy_plan_consent (
    id                    BIGSERIAL PRIMARY KEY,
    consent_id            VARCHAR(100) NOT NULL,
    chemotherapy_plan_id  VARCHAR(100) NOT NULL,
    patient_id            VARCHAR(100) NOT NULL,
    patient_signature     TEXT,
    witness_signature     TEXT,
    doctor_signature      TEXT,
    patient_name          VARCHAR(255),
    witness_name          VARCHAR(255),
    witness_relation      VARCHAR(100),
    doctor_name           VARCHAR(255),
    doctor_reg_no         VARCHAR(100),
    consent_date          DATE,
    status                VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    signed_at             TIMESTAMP(6),
    signed_by             VARCHAR(100),
    created_at            TIMESTAMP(6) DEFAULT now(),
    updated_at            TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_chemo_plan_consent_id UNIQUE (consent_id),
    CONSTRAINT uq_chemo_plan_consent_plan UNIQUE (chemotherapy_plan_id),
    CONSTRAINT chk_chemo_plan_consent_status
        CHECK (status IN ('DRAFT', 'SIGNED')),
    CONSTRAINT fk_chemo_plan_consent_plan FOREIGN KEY (chemotherapy_plan_id)
        REFERENCES public.chemotherapy_plan (chemotherapy_plan_id)
        ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_chemo_plan_consent_patient
    ON public.chemotherapy_plan_consent (patient_id);

COMMIT;
