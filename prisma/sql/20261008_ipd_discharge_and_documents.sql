-- IPD discharge detail capture + encounter-scoped documents + review-date
-- follow-up tracking.
--
-- Three independent, additive pieces:
--
--   1. admission gets four new discharge fields:
--        discharge_advice             -- take-home instructions (for the
--                                         patient), separate from
--                                         discharge_summary (the clinical
--                                         record, for other doctors).
--        review_date                  -- target follow-up date; turned into
--                                         a real appointment later (see
--                                         discharge_review_reminder below).
--        discharge_disease_status     -- free-text label, same pattern as
--                                         oncology_staging_detail.disease_status
--                                         (denormalized text, not an FK) --
--                                         sourced from the same
--                                         GET /oncology/reference/disease-statuses
--                                         list the doctor's Diagnosis form
--                                         already maintains via
--                                         disease_status_master.
--        patient_status_at_discharge  -- fixed clinical vocabulary (STABLE /
--                                         IMPROVED / UNCHANGED / DETERIORATED /
--                                         CRITICAL / DECEASED), validated at
--                                         the app layer like discharge_type is
--                                         -- no DB CHECK constraint, consistent
--                                         with how every other admission
--                                         status column in this schema works.
--
--   2. The missing admission.encounter_no -> encounter.encounter_no foreign
--      key is added (it was a bare VARCHAR with no constraint -- see
--      IPD_flaws.md #9), and patient_document gets its own encounter_no so a
--      document uploaded from OPD or from an IPD stay is scoped to the one
--      visit/stay it belongs to, instead of one flat per-patient bucket.
--      document_type is a free-text taxonomy column (BIOPSY_REPORT /
--      DISCHARGE_DOCUMENT / LAB_REPORT / IMAGING / CONSENT_FORM / OTHER),
--      validated at the app layer the same way category already is.
--
--   3. discharge_review_reminder + followup_contact_log: a due-date tracker
--      for the review_date above, plus an append-only audit log of every
--      contact attempt (automated SMS/email once a provider exists, or a
--      manual call logged by staff) -- modeled directly on the existing
--      appointment_reschedule_queue / appointment_reschedule_action_log
--      pattern already used for a conceptually identical problem (track
--      who did what to get a patient onto a new slot). A reminder becomes a
--      real appointment_history row once the patient confirms --
--      converted_appointment_id records that handoff.
--
-- Apply after 20261007_daily_sweeps_pg_cron.sql. Additive only.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. admission: discharge detail fields
-- ---------------------------------------------------------------------

ALTER TABLE public.admission
    ADD COLUMN IF NOT EXISTS discharge_advice             TEXT,
    ADD COLUMN IF NOT EXISTS review_date                  DATE,
    ADD COLUMN IF NOT EXISTS discharge_disease_status     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS patient_status_at_discharge  VARCHAR(100);

-- ---------------------------------------------------------------------
-- 2a. admission.encounter_no -> encounter.encounter_no (was unenforced)
-- ---------------------------------------------------------------------

-- Refuse to run (instead of failing halfway) if live data already breaks the
-- rule; those rows have to be resolved by hand first. To list them:
--   SELECT admission_id, ip_number, encounter_no FROM public.admission a
--    WHERE encounter_no IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM public.encounter e WHERE e.encounter_no = a.encounter_no);
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.admission a
         WHERE a.encounter_no IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM public.encounter e WHERE e.encounter_no = a.encounter_no
           )
    ) THEN
        RAISE EXCEPTION 'Some admissions have an encounter_no with no matching encounter row -- resolve them before applying this migration';
    END IF;
END $$;

ALTER TABLE public.admission
    ADD CONSTRAINT fk_admission_encounter
    FOREIGN KEY (encounter_no)
    REFERENCES public.encounter (encounter_no)
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------
-- 2b. patient_document: scope to an encounter, add a type taxonomy
-- ---------------------------------------------------------------------

ALTER TABLE public.patient_document
    ADD COLUMN IF NOT EXISTS encounter_no  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS document_type VARCHAR(100);

ALTER TABLE public.patient_document
    ADD CONSTRAINT fk_patient_document_encounter
    FOREIGN KEY (encounter_no)
    REFERENCES public.encounter (encounter_no)
    ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_patient_document_encounter
    ON public.patient_document (encounter_no)
    WHERE encounter_no IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Review-date follow-up tracking
-- ---------------------------------------------------------------------

-- status: PENDING -> CONTACTED -> CONFIRMED / NO_RESPONSE / CANCELLED
--         -> CONVERTED_TO_APPOINTMENT (converted_appointment_id set)
CREATE TABLE IF NOT EXISTS public.discharge_review_reminder (
    id                       BIGSERIAL     PRIMARY KEY,
    reminder_id              VARCHAR(100)  UNIQUE NOT NULL,
    admission_id             VARCHAR(100)  NOT NULL,
    patient_id               VARCHAR(100)  NOT NULL,
    due_date                 DATE          NOT NULL,
    status                   VARCHAR(100)  NOT NULL DEFAULT 'PENDING',
    converted_appointment_id VARCHAR(100),
    created_by               VARCHAR(100),
    created_at               TIMESTAMP(6)  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMP(6)  NOT NULL DEFAULT now(),
    CONSTRAINT fk_review_reminder_admission
        FOREIGN KEY (admission_id) REFERENCES public.admission (admission_id)
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_review_reminder_patient
        FOREIGN KEY (patient_id) REFERENCES public.patient_bio_data (patient_id)
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_review_reminder_appointment
        FOREIGN KEY (converted_appointment_id) REFERENCES public.appointment_history (appointment_id)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_review_reminder_admission
    ON public.discharge_review_reminder (admission_id);

CREATE INDEX IF NOT EXISTS idx_review_reminder_status_due
    ON public.discharge_review_reminder (status, due_date);

-- action: SMS_SENT / EMAIL_SENT / CALL_MADE / PATIENT_CONFIRMED /
--         PATIENT_DECLINED / NO_ANSWER / RESCHEDULE_REQUESTED
-- performed_by: a staff user_id for a manual call, or "SYSTEM" for an
-- automated send -- same convention admission.updated_by already uses for
-- the nightly sweep.
CREATE TABLE IF NOT EXISTS public.followup_contact_log (
    id            BIGSERIAL     PRIMARY KEY,
    log_id        VARCHAR(100)  UNIQUE NOT NULL,
    reminder_id   VARCHAR(100)  NOT NULL,
    action        VARCHAR(100)  NOT NULL,
    performed_by  VARCHAR(100)  NOT NULL,
    notes         TEXT,
    created_at    TIMESTAMP(6)  NOT NULL DEFAULT now(),
    CONSTRAINT fk_followup_log_reminder
        FOREIGN KEY (reminder_id) REFERENCES public.discharge_review_reminder (reminder_id)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_followup_log_reminder
    ON public.followup_contact_log (reminder_id);

COMMIT;
