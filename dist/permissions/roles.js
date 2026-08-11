"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRANCH_RESTRICTED_ROLES = exports.LOGIN_ENABLED_ROLES = exports.ADMIN_ROLES = exports.BRANCH_ADMIN_ROLES = exports.TOP_LEVEL_ADMIN_ROLES = exports.PATIENT = exports.STAFF = exports.RECEPTIONIST = exports.LAB_TECHNICIAN = exports.PHARMACIST = exports.NURSE = exports.DOCTOR = exports.BRANCH_ADMIN = exports.ADMIN = exports.SUPER_ADMIN = exports.HEAD_ADMIN = void 0;
exports.HEAD_ADMIN = "HEAD_ADMIN";
exports.SUPER_ADMIN = "SUPER_ADMIN";
exports.ADMIN = "ADMIN";
exports.BRANCH_ADMIN = "BRANCH_ADMIN";
exports.DOCTOR = "DOCTOR";
exports.NURSE = "NURSE";
exports.PHARMACIST = "PHARMACIST";
exports.LAB_TECHNICIAN = "LAB_TECHNICIAN";
exports.RECEPTIONIST = "RECEPTIONIST";
exports.STAFF = "STAFF";
exports.PATIENT = "PATIENT";
// Roles that bypass per-branch scoping entirely and see every branch.
// Used by branchScope.ts (default-deny: only these roles get unrestricted
// access, everything else - known or not - is branch-scoped).
exports.TOP_LEVEL_ADMIN_ROLES = [exports.HEAD_ADMIN, exports.SUPER_ADMIN];
// Top-level admins plus a branch's own admin - for actions a Branch Admin
// may perform on their own branch (e.g. doctor transfers, appointment
// reschedule queue) without needing to escalate to a top-level admin.
exports.BRANCH_ADMIN_ROLES = [...exports.TOP_LEVEL_ADMIN_ROLES, exports.BRANCH_ADMIN];
exports.ADMIN_ROLES = [...exports.TOP_LEVEL_ADMIN_ROLES, exports.ADMIN];
// Clinical roles need to log in to use the oncology/chemotherapy module
// (create diagnoses/plans as a doctor, record administration/vitals as a
// nurse, verify drugs as a pharmacist) - added alongside the admin roles
// rather than replacing them.
exports.LOGIN_ENABLED_ROLES = [...exports.TOP_LEVEL_ADMIN_ROLES, exports.BRANCH_ADMIN, exports.ADMIN, exports.DOCTOR, exports.NURSE, exports.PHARMACIST];
exports.BRANCH_RESTRICTED_ROLES = [exports.BRANCH_ADMIN, exports.ADMIN];
