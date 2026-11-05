-- IPD Staff Duty Roster & Branch Shift Management
-- Supports:
--   1. branch_shift_master: Branch-customizable shifts (Morning, Evening, Night, etc.)
--   2. staff_duty_roster_template: Weekly recurring shift patterns
--   3. staff_duty_roster: Specific calendar date shift entries for duty doctors & nurses
--   4. Permission 'ipd.duty_roster' & sequences (BSM, SDT, SDR)

BEGIN;

-- ========================================================
-- 1. branch_shift_master
-- ========================================================
CREATE TABLE IF NOT EXISTS public.branch_shift_master (
    id              BIGSERIAL PRIMARY KEY,
    shift_id        VARCHAR(100) NOT NULL,
    branch_id       VARCHAR(100) NOT NULL,
    shift_code      VARCHAR(50)  NOT NULL,
    shift_name      VARCHAR(100) NOT NULL,
    start_time      TIME(6)      NOT NULL,
    end_time        TIME(6)      NOT NULL,
    is_overnight    BOOLEAN      NOT NULL DEFAULT false,
    display_order   INT          NOT NULL DEFAULT 1,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMP(6) NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT uq_branch_shift_id UNIQUE (shift_id),
    CONSTRAINT uq_branch_shift_code UNIQUE (branch_id, shift_code),
    CONSTRAINT fk_branch_shift_branch FOREIGN KEY (branch_id)
        REFERENCES public.branch (branch_id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_branch_shift_branch_active
    ON public.branch_shift_master (branch_id, is_active);

-- ========================================================
-- 2. staff_duty_roster_template (weekly recurring)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.staff_duty_roster_template (
    id              BIGSERIAL PRIMARY KEY,
    template_id     VARCHAR(100) NOT NULL,
    employee_id     VARCHAR(100) NOT NULL,
    branch_id       VARCHAR(100) NOT NULL,
    day_of_week     VARCHAR(20)  NOT NULL,
    shift_code      VARCHAR(50)  NOT NULL,
    start_time      TIME(6)      NOT NULL,
    end_time        TIME(6)      NOT NULL,
    role_in_duty    VARCHAR(50)  NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    effective_from  DATE,
    effective_to    DATE,
    created_by      VARCHAR(100),
    created_at      TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT uq_duty_template_id UNIQUE (template_id),
    CONSTRAINT uq_duty_template_slot
        UNIQUE (employee_id, branch_id, day_of_week, shift_code, role_in_duty),
    CONSTRAINT chk_duty_template_role
        CHECK (role_in_duty IN ('DUTY_DOCTOR', 'DUTY_NURSE')),
    CONSTRAINT chk_duty_template_day
        CHECK (day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    CONSTRAINT fk_duty_template_employee FOREIGN KEY (employee_id)
        REFERENCES public.employees (employee_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_duty_template_branch FOREIGN KEY (branch_id)
        REFERENCES public.branch (branch_id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_duty_template_branch_day
    ON public.staff_duty_roster_template (branch_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_duty_template_employee
    ON public.staff_duty_roster_template (employee_id);

-- ========================================================
-- 3. staff_duty_roster (specific date entries / overrides)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.staff_duty_roster (
    id              BIGSERIAL PRIMARY KEY,
    roster_id       VARCHAR(100) NOT NULL,
    employee_id     VARCHAR(100) NOT NULL,
    branch_id       VARCHAR(100) NOT NULL,
    duty_date       DATE         NOT NULL,
    shift_code      VARCHAR(50)  NOT NULL,
    start_time      TIME(6)      NOT NULL,
    end_time        TIME(6)      NOT NULL,
    role_in_duty    VARCHAR(50)  NOT NULL,
    notes           TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_by      VARCHAR(100),
    created_at      TIMESTAMP(6) NOT NULL DEFAULT now(),
    updated_by      VARCHAR(100),
    updated_at      TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT uq_duty_roster_id UNIQUE (roster_id),
    CONSTRAINT uq_duty_roster_slot
        UNIQUE (employee_id, branch_id, duty_date, shift_code, role_in_duty),
    CONSTRAINT chk_duty_roster_role
        CHECK (role_in_duty IN ('DUTY_DOCTOR', 'DUTY_NURSE')),
    CONSTRAINT fk_duty_roster_employee FOREIGN KEY (employee_id)
        REFERENCES public.employees (employee_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_duty_roster_branch FOREIGN KEY (branch_id)
        REFERENCES public.branch (branch_id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_duty_roster_branch_date
    ON public.staff_duty_roster (branch_id, duty_date, shift_code);
CREATE INDEX IF NOT EXISTS idx_duty_roster_employee_date
    ON public.staff_duty_roster (employee_id, duty_date);

-- ========================================================
-- 4. ID sequences
-- ========================================================
INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'BRANCH_SHIFT', 'BSM', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'BRANCH_SHIFT');

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'DUTY_TEMPLATE', 'SDT', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'DUTY_TEMPLATE');

INSERT INTO public.id_sequences (entity_name, prefix, current_number)
SELECT 'DUTY_ROSTER', 'SDR', 0
WHERE NOT EXISTS (SELECT 1 FROM public.id_sequences WHERE entity_name = 'DUTY_ROSTER');

-- ========================================================
-- 5. Permission & Role Grants
-- ========================================================
INSERT INTO "Permission" (id, key, name, description, category, updated_at)
SELECT gen_random_uuid()::text, 'ipd.duty_roster', 'Manage IPD Duty Roster',
       'Create, view, and update duty schedules and shift configurations for doctors and nurses', 'ipd', now()
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE key = 'ipd.duty_roster');

INSERT INTO "RolePermission" (id, role_type, permission_id, granted_by)
SELECT gen_random_uuid(), r.role_type, p.id, 'SYSTEM_SEED'
FROM "Permission" p
CROSS JOIN (VALUES ('SUPER_ADMIN'), ('HEAD_ADMIN'), ('BRANCH_ADMIN'), ('ADMIN'), ('DOCTOR'), ('NURSE')) AS r(role_type)
WHERE p.key = 'ipd.duty_roster'
ON CONFLICT (role_type, permission_id) DO UPDATE SET revoked_at = NULL, revoked_by = NULL;

-- ========================================================
-- 6. Default Shift Seed for Active Branches
-- ========================================================
INSERT INTO public.branch_shift_master (
    shift_id, branch_id, shift_code, shift_name, start_time, end_time, is_overnight, display_order, is_active
)
SELECT
    'BSM-' || b.branch_id || '-MORN', b.branch_id, 'MORNING', 'Morning Shift',
    '07:00:00'::TIME, '15:00:00'::TIME, false, 1, true
FROM public.branch b
WHERE b.branch_status = 'Active'
ON CONFLICT (branch_id, shift_code) DO NOTHING;

INSERT INTO public.branch_shift_master (
    shift_id, branch_id, shift_code, shift_name, start_time, end_time, is_overnight, display_order, is_active
)
SELECT
    'BSM-' || b.branch_id || '-EVE', b.branch_id, 'EVENING', 'Evening Shift',
    '15:00:00'::TIME, '23:00:00'::TIME, false, 2, true
FROM public.branch b
WHERE b.branch_status = 'Active'
ON CONFLICT (branch_id, shift_code) DO NOTHING;

INSERT INTO public.branch_shift_master (
    shift_id, branch_id, shift_code, shift_name, start_time, end_time, is_overnight, display_order, is_active
)
SELECT
    'BSM-' || b.branch_id || '-NGT', b.branch_id, 'NIGHT', 'Night Shift',
    '23:00:00'::TIME, '07:00:00'::TIME, true, 3, true
FROM public.branch b
WHERE b.branch_status = 'Active'
ON CONFLICT (branch_id, shift_code) DO NOTHING;

INSERT INTO public.branch_shift_master (
    shift_id, branch_id, shift_code, shift_name, start_time, end_time, is_overnight, display_order, is_active
)
SELECT
    'BSM-' || b.branch_id || '-GEN', b.branch_id, 'GENERAL', 'General Duty',
    '09:00:00'::TIME, '17:00:00'::TIME, false, 4, true
FROM public.branch b
WHERE b.branch_status = 'Active'
ON CONFLICT (branch_id, shift_code) DO NOTHING;

COMMIT;

