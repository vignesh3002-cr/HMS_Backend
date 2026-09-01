// Single source of truth for role_type string constants and the role
// groupings used by `authorize()` and `branchScope`. Previously these lists
// were hand-duplicated per route file (branch.routes.ts, doctorTransfer.
// routes.ts, branchScope.ts, auth.service.ts) and drifted out of sync -
// e.g. user.routes.ts checked for a literal "ADMIN" role_type that no
// account is ever created with, silently locking out every real admin.
//
// `authorize()` and `branchScope` both compare roles case-insensitively, so
// each role only needs to be listed once here regardless of casing used
// elsewhere historically ("Admin" vs "ADMIN").

export const HEAD_ADMIN = "HEAD_ADMIN";
export const SUPER_ADMIN = "SUPER_ADMIN";
export const ADMIN = "ADMIN";
export const BRANCH_ADMIN = "BRANCH_ADMIN";
export const DOCTOR = "DOCTOR";
export const NURSE = "NURSE";
export const PHARMACIST = "PHARMACIST";
export const LAB_TECHNICIAN = "LAB_TECHNICIAN";
export const RECEPTIONIST = "RECEPTIONIST";
export const STAFF = "STAFF";
export const PATIENT = "PATIENT";

// Roles that bypass per-branch scoping entirely and see every branch.
// Used by branchScope.ts (default-deny: only these roles get unrestricted
// access, everything else - known or not - is branch-scoped).
export const TOP_LEVEL_ADMIN_ROLES = [HEAD_ADMIN, SUPER_ADMIN];

// Top-level admins plus a branch's own admin - for actions a Branch Admin
// may perform on their own branch (e.g. doctor transfers, appointment
// reschedule queue) without needing to escalate to a top-level admin.
export const BRANCH_ADMIN_ROLES = [...TOP_LEVEL_ADMIN_ROLES, BRANCH_ADMIN];
export const ADMIN_ROLES = [...TOP_LEVEL_ADMIN_ROLES, ADMIN];

export const LOGIN_ENABLED_ROLES = [...TOP_LEVEL_ADMIN_ROLES, BRANCH_ADMIN, ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, LAB_TECHNICIAN];

export const BRANCH_RESTRICTED_ROLES = [BRANCH_ADMIN, ADMIN];