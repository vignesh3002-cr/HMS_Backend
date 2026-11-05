"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../../../config/prisma"));
const auth_middleware_1 = require("../../auth/auth.middleware");
const authorize_1 = require("../../../middleware/authorize");
const roles_1 = require("../../../permissions/roles");
const dutyRoster_controller_1 = require("./dutyRoster.controller");
const router = (0, express_1.Router)();
const controller = new dutyRoster_controller_1.DutyRosterController();
// Only admins may change the roster / shift configuration. Doctors and nurses
// keep read access (they hold ipd.duty_roster for viewing their own rota).
const adminWrite = (0, authorize_1.authorizeRoles)("SUPER_ADMIN", "HEAD_ADMIN", "ADMIN", "BRANCH_ADMIN");
/*
 * Record-level branch isolation. The roster routes take branch_id straight
 * from the query/body, so branchScope can't vouch for it; check the caller's
 * ACTIVE branch mapping instead (top-level admins may access every branch).
 * `resolveBranch` returns the branch the request targets ("" = unknown, which
 * the service layer then rejects with its own validation message).
 */
const branchAccess = (resolveBranch) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            const role = String(user?.role ?? "").toLowerCase();
            if (roles_1.TOP_LEVEL_ADMIN_ROLES.some((r) => r.toLowerCase() === role)) {
                return next();
            }
            const branchId = await resolveBranch(req);
            if (!branchId)
                return next();
            const mapping = await prisma_1.default.user_branch_mapping.findFirst({
                where: { user_id: user?.user_id, branch_id: branchId, status: 1 },
                select: { branch_id: true },
            });
            if (!mapping) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden. You don't have access to this branch.",
                });
            }
            next();
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    };
};
const byQueryBranch = branchAccess((req) => String(req.query.branchId ?? ""));
const byBodyBranch = branchAccess((req) => String(req.body?.branch_id ?? ""));
const byShiftRecord = branchAccess(async (req) => {
    const row = await prisma_1.default.branch_shift_master.findUnique({
        where: { shift_id: String(req.params.shiftId) },
        select: { branch_id: true },
    });
    return row?.branch_id ?? "";
});
const byTemplateRecord = branchAccess(async (req) => {
    const row = await prisma_1.default.staff_duty_roster_template.findUnique({
        where: { template_id: String(req.params.templateId) },
        select: { branch_id: true },
    });
    return row?.branch_id ?? "";
});
const byRosterRecord = branchAccess(async (req) => {
    const row = await prisma_1.default.staff_duty_roster.findUnique({
        where: { roster_id: String(req.params.rosterId) },
        select: { branch_id: true },
    });
    return row?.branch_id ?? "";
});
// -------------------------------------------------------------
// Availability Query (Used by Allocate Care Team dialog)
// -------------------------------------------------------------
router.get("/available", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("admission.read", "ipd.duty_roster", "admission.care_team"), byQueryBranch, controller.getAvailableStaff.bind(controller));
// -------------------------------------------------------------
// Branch Shift Configurations
// -------------------------------------------------------------
router.get("/branch-shifts", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("admission.read", "ipd.duty_roster"), byQueryBranch, controller.getBranchShifts.bind(controller));
router.post("/branch-shifts", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), adminWrite, byBodyBranch, controller.createBranchShift.bind(controller));
router.patch("/branch-shifts/:shiftId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), adminWrite, byShiftRecord, controller.updateBranchShift.bind(controller));
// -------------------------------------------------------------
// Weekly Recurring Templates
// -------------------------------------------------------------
router.get("/templates", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("admission.read", "ipd.duty_roster"), byQueryBranch, controller.getTemplates.bind(controller));
router.post("/templates", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), adminWrite, byBodyBranch, controller.upsertTemplate.bind(controller));
router.delete("/templates/:templateId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), adminWrite, byTemplateRecord, controller.deleteTemplate.bind(controller));
// -------------------------------------------------------------
// Date-specific Duty Roster Entries
// -------------------------------------------------------------
router.get("/roster", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("admission.read", "ipd.duty_roster"), byQueryBranch, controller.getRoster.bind(controller));
router.post("/roster", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), adminWrite, byBodyBranch, controller.upsertRosterEntry.bind(controller));
router.delete("/roster/:rosterId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), adminWrite, byRosterRecord, controller.deleteRosterEntry.bind(controller));
exports.default = router;
