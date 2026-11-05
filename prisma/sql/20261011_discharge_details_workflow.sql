-- Doctor-entered discharge details, admin-confirmed discharge.
--
--   admission.discharge_details_by / _at
--       Who saved the clinical discharge details (doctor, Discharge
--       Medication step) and when. Set while the admission is still
--       ADMITTED; an admin can only confirm the discharge once these exist.
--
--   admission.discharge_details  (new permission, DOCTOR)
--       Saving the details. DOCTOR's admission.discharge grant is revoked --
--       the doctor no longer performs the discharge itself.
--
--   Staff Admin designation cleanup
--       Every ADMIN-role employee gets designation 'Staff Admin' (the
--       form no longer offers a designation for admin roles).
--
-- Additive except the two data fixes noted above.

BEGIN;

ALTER TABLE public.admission
    ADD COLUMN IF NOT EXISTS discharge_details_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS discharge_details_at TIMESTAMP(6);

INSERT INTO "Permission" (id, key, name, description, category, updated_at)
SELECT gen_random_uuid()::text, 'admission.discharge_details', 'Save Discharge Details',
       'Record clinical discharge details for an admitted inpatient', 'admission', now()
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE key = 'admission.discharge_details');

INSERT INTO "RolePermission" (id, role_type, permission_id, granted_by)
SELECT gen_random_uuid(), 'DOCTOR', id, 'SYSTEM_SEED'
FROM "Permission" WHERE key = 'admission.discharge_details'
ON CONFLICT (role_type, permission_id) DO UPDATE SET revoked_at = NULL, revoked_by = NULL;

UPDATE "RolePermission" SET revoked_at = now(), revoked_by = 'SYSTEM_SEED'
WHERE role_type = 'DOCTOR' AND revoked_at IS NULL
  AND permission_id = (SELECT id FROM "Permission" WHERE key = 'admission.discharge');

UPDATE public.employees e SET designation = 'Staff Admin'
FROM public.user_table u
WHERE u.user_id = e.user_id AND u.role_type = 'ADMIN'
  AND e.designation IS DISTINCT FROM 'Staff Admin';

COMMIT;
