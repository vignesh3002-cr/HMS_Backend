-- IPD care team: duty doctor / primary nurse allocation with shift handover.
--
--   admission_care_team
--       Append-only audit log. One row per allocation of a duty doctor
--       (ASSIGNED_DOCTOR) or primary nurse (PRIMARY_NURSE) to an admission,
--       with automatic start/end time and handover notes. A handover closes the
--       previous active row (is_active=false, end_time, end_reason) and opens
--       a new one. uq_care_team_active_role guarantees at most ONE active row
--       per (admission, role), even under concurrent handovers.
--       The consultant stays in admission.employee_id -- not duplicated here.
--
--   admission.current_assigned_doctor_id / current_nurse_id
--       Mirrors of the active rows, for the roster. Written only by the
--       care-team service in the same transaction as the care-team row.
--
--   admission.care_team  (new permission)
--       Allocate / hand over the care team. Granted to the roles that run a
--       ward: BRANCH_ADMIN, ADMIN, DOCTOR, NURSE (and all-permission roles).
--
-- Additive only. Existing admissions simply have no care team yet.

BEGIN;

ALTER TABLE public.admission
    ADD COLUMN IF NOT EXISTS current_assigned_doctor_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS current_nurse_id           VARCHAR(100);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_admission_assigned_doctor') THEN
        ALTER TABLE public.admission
            ADD CONSTRAINT fk_admission_assigned_doctor FOREIGN KEY (current_assigned_doctor_id)
            REFERENCES public.employees (employee_id) ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_admission_assigned_nurse') THEN
        ALTER TABLE public.admission
            ADD CONSTRAINT fk_admission_assigned_nurse FOREIGN KEY (current_nurse_id)
            REFERENCES public.employees (employee_id) ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admission_assigned_doctor ON public.admission (current_assigned_doctor_id);
CREATE INDEX IF NOT EXISTS idx_admission_assigned_nurse  ON public.admission (current_nurse_id);

CREATE TABLE IF NOT EXISTS public.admission_care_team (
    id             BIGSERIAL PRIMARY KEY,
    assignment_id  VARCHAR(100) NOT NULL,
    admission_id   VARCHAR(100) NOT NULL,
    employee_id    VARCHAR(100) NOT NULL,
    role_in_team   VARCHAR(50)  NOT NULL,
    -- start_time / end_time are stamped automatically: start when the row is
    -- saved, end when the person is replaced, removed, or the patient discharged.
    start_time    TIMESTAMP(6) NOT NULL DEFAULT now(),
    end_time       TIMESTAMP(6),
    is_active      BOOLEAN      NOT NULL DEFAULT true,
    end_reason     VARCHAR(50),
    handover_notes TEXT,
    assigned_by    VARCHAR(100),
    created_at     TIMESTAMP(6) NOT NULL DEFAULT now(),
    CONSTRAINT uq_care_team_assignment_id UNIQUE (assignment_id),
    CONSTRAINT chk_care_team_role
        CHECK (role_in_team IN ('ASSIGNED_DOCTOR', 'PRIMARY_NURSE')),
    CONSTRAINT chk_care_team_active_end
        CHECK ((is_active AND end_time IS NULL) OR (NOT is_active AND end_time IS NOT NULL)),
    CONSTRAINT fk_care_team_admission FOREIGN KEY (admission_id)
        REFERENCES public.admission (admission_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_care_team_employee FOREIGN KEY (employee_id)
        REFERENCES public.employees (employee_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- One active row per role per admission. Postgres has no partial UNIQUE
-- constraint, so this is a unique index (same approach as uq_pharmacy_slip_order).
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_team_active_role
    ON public.admission_care_team (admission_id, role_in_team)
    WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_care_team_admission_active
    ON public.admission_care_team (admission_id, is_active);
CREATE INDEX IF NOT EXISTS idx_care_team_employee_active
    ON public.admission_care_team (employee_id, is_active);
-- Shift tracking was dropped (time is tracked automatically instead). If an
-- earlier version of this script already ran, remove its shift columns; the
-- drops also remove idx_care_team_shift and chk_care_team_shift.
ALTER TABLE public.admission_care_team
    DROP COLUMN IF EXISTS shift,
    DROP COLUMN IF EXISTS shift_date;

ALTER TABLE public.admission_care_team ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.admission_care_team FROM anon, authenticated, service_role;

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'CARE_TEAM', 'ACT', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'CARE_TEAM');

-- Permission + grants
INSERT INTO "Permission" (id, key, name, description, category, updated_at)
SELECT gen_random_uuid()::text, 'admission.care_team', 'Manage Care Team',
       'Assign the duty doctor and nurse for an admitted inpatient and record handover', 'admission', now()
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE key = 'admission.care_team');

INSERT INTO "RolePermission" (id, role_type, permission_id, granted_by)
SELECT gen_random_uuid(), r.role_type, p.id, 'SYSTEM_SEED'
FROM "Permission" p
CROSS JOIN (VALUES ('SUPER_ADMIN'), ('HEAD_ADMIN'), ('BRANCH_ADMIN'), ('ADMIN'), ('DOCTOR'), ('NURSE')) AS r(role_type)
WHERE p.key = 'admission.care_team'
ON CONFLICT (role_type, permission_id) DO UPDATE SET revoked_at = NULL, revoked_by = NULL;

COMMIT;
