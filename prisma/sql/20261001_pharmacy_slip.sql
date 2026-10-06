-- Pharmacy slip: one issued document per appointment. Two tables:
--   pharmacy_slip       the header (patient, visit, lifecycle)
--   pharmacy_slip_item  a frozen copy of each medicine line at snapshot time

BEGIN;

-- ------------------------------------------------- pharmacy_slip (header)
CREATE TABLE IF NOT EXISTS public.pharmacy_slip (
    id                  BIGSERIAL PRIMARY KEY,
    pharmacy_slip_id    VARCHAR(100) NOT NULL,
    patient_id          VARCHAR(100) NOT NULL,
    branch_id           VARCHAR(100) NOT NULL,
    -- The visit this slip belongs to.
    encounter_no        VARCHAR(100),
    appointment_id      VARCHAR(100),
    -- Set when the slip was resolved from a chemo cycle-day order.
    plan_order_id       VARCHAR(100),
    cycle_number        INT,
    cycle_day           INT,
    protocol_name       VARCHAR(100),
    regimen_name       VARCHAR(100),
    slip_status         VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    issued_at           TIMESTAMP(6),
    issued_by           VARCHAR(100),
    printed_at          TIMESTAMP(6),
    printed_by          VARCHAR(100),
    cancelled_at        TIMESTAMP(6),
    cancelled_by        VARCHAR(100),
    cancellation_reason VARCHAR(255),
    created_by          VARCHAR(100),
    created_at          TIMESTAMP(6) DEFAULT now(),
    updated_by          VARCHAR(100),
    updated_at          TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_pharmacy_slip_id UNIQUE (pharmacy_slip_id),
    CONSTRAINT chk_pharmacy_slip_status
        CHECK (slip_status IN ('DRAFT', 'ISSUED', 'CANCELLED')),
    -- ISSUED requires issued_at. A cancelled slip may or may not carry one:
    -- cancelling an already-issued slip keeps the original issue timestamp.
    CONSTRAINT chk_pharmacy_slip_issued
        CHECK (slip_status <> 'ISSUED' OR issued_at IS NOT NULL),
    CONSTRAINT fk_pharmacy_slip_patient FOREIGN KEY (patient_id)
        REFERENCES public.patient_bio_data (patient_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_pharmacy_slip_branch FOREIGN KEY (branch_id)
        REFERENCES public.branch (branch_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_pharmacy_slip_encounter FOREIGN KEY (encounter_no)
        REFERENCES public.encounter (encounter_no) ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- One live slip per cycle-day order. Partial, so a cancelled slip frees the
-- slot for a replacement on the same day. Postgres has no partial UNIQUE
-- constraint, so this must be a unique index rather than a table constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacy_slip_order
    ON public.pharmacy_slip (plan_order_id)
    WHERE plan_order_id IS NOT NULL AND slip_status <> 'CANCELLED';

CREATE INDEX IF NOT EXISTS idx_pharmacy_slip_patient
    ON public.pharmacy_slip (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_slip_branch
    ON public.pharmacy_slip (branch_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_slip_encounter
    ON public.pharmacy_slip (encounter_no);
CREATE INDEX IF NOT EXISTS idx_pharmacy_slip_status
    ON public.pharmacy_slip (slip_status, created_at DESC);

ALTER TABLE public.pharmacy_slip ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_slip FROM anon, authenticated, service_role;

-- -------------------------------------------- pharmacy_slip_item (lines)
CREATE TABLE IF NOT EXISTS public.pharmacy_slip_item (
    id                    BIGSERIAL PRIMARY KEY,
    pharmacy_slip_item_id VARCHAR(100) NOT NULL,
    pharmacy_slip_id      VARCHAR(100) NOT NULL,
    display_order         INT NOT NULL DEFAULT 0,
    medicine_id           VARCHAR(100),
    -- The medicine's display name. For a catalog line this is generated from
    -- medicine_master.medicine_name via medicine_id at snapshot time, so an
    -- already printed slip keeps the name that was dispensed even if the
    -- catalog row is later renamed. Only free-typed "Others" drugs carry a
    -- literal value typed in by the prescriber.
    drug_name             VARCHAR(200),
    brand_name            VARCHAR(255),
    dose                  VARCHAR(100),
    dose_unit             VARCHAR(50),
    -- Pharmacy-filled pack quantity (integer only).
    quantity              INT,
    drug_role             VARCHAR(100),
    route                 VARCHAR(100),
    frequency             VARCHAR(100),
    duration              VARCHAR(100),
    instructions          VARCHAR(255),
    created_at            TIMESTAMP(6) DEFAULT now(),
    updated_at            TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT uq_pharmacy_slip_item_id UNIQUE (pharmacy_slip_item_id),
    CONSTRAINT chk_pharmacy_slip_item_drug
        CHECK (medicine_id IS NOT NULL OR NULLIF(btrim(drug_name), '') IS NOT NULL),
    CONSTRAINT fk_pharmacy_slip_item_slip FOREIGN KEY (pharmacy_slip_id)
        REFERENCES public.pharmacy_slip (pharmacy_slip_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_pharmacy_slip_item_medicine FOREIGN KEY (medicine_id)
        REFERENCES public.medicine_master (medicine_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_slip_item_slip
    ON public.pharmacy_slip_item (pharmacy_slip_id, display_order);
CREATE INDEX IF NOT EXISTS idx_pharmacy_slip_item_medicine
    ON public.pharmacy_slip_item (medicine_id);

ALTER TABLE public.pharmacy_slip_item ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_slip_item FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'PHARMACY_SLIP', 'PSL', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'PHARMACY_SLIP');

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'PHARMACY_SLIP_ITEM', 'PSLI', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'PHARMACY_SLIP_ITEM');

COMMIT;