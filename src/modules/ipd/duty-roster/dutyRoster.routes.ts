import { NextFunction, Request, RequestHandler, Response, Router } from "express";
import prisma from "../../../config/prisma";
import { authenticate } from "../../auth/auth.middleware";
import { authorize, authorizeAny, authorizeRoles } from "../../../middleware/authorize";
import { TOP_LEVEL_ADMIN_ROLES } from "../../../permissions/roles";
import { DutyRosterController } from "./dutyRoster.controller";

const router = Router();
const controller = new DutyRosterController();

// Only admins may change the roster / shift configuration. Doctors and nurses
// keep read access (they hold ipd.duty_roster for viewing their own rota).
const adminWrite = authorizeRoles("SUPER_ADMIN", "HEAD_ADMIN", "ADMIN", "BRANCH_ADMIN");

/*
 * Record-level branch isolation. The roster routes take branch_id straight
 * from the query/body, so branchScope can't vouch for it; check the caller's
 * ACTIVE branch mapping instead (top-level admins may access every branch).
 * `resolveBranch` returns the branch the request targets ("" = unknown, which
 * the service layer then rejects with its own validation message).
 */
const branchAccess = (
    resolveBranch: (req: Request) => string | Promise<string>
): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const role = String(user?.role ?? "").toLowerCase();
            if (TOP_LEVEL_ADMIN_ROLES.some((r) => r.toLowerCase() === role)) {
                return next();
            }

            const branchId = await resolveBranch(req);
            if (!branchId) return next();

            const mapping = await prisma.user_branch_mapping.findFirst({
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
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    };
};

const byQueryBranch = branchAccess((req) => String(req.query.branchId ?? ""));
const byBodyBranch = branchAccess((req) => String(req.body?.branch_id ?? ""));
const byShiftRecord = branchAccess(async (req) => {
    const row = await prisma.branch_shift_master.findUnique({
        where: { shift_id: String(req.params.shiftId) },
        select: { branch_id: true },
    });
    return row?.branch_id ?? "";
});
const byTemplateRecord = branchAccess(async (req) => {
    const row = await prisma.staff_duty_roster_template.findUnique({
        where: { template_id: String(req.params.templateId) },
        select: { branch_id: true },
    });
    return row?.branch_id ?? "";
});
const byRosterRecord = branchAccess(async (req) => {
    const row = await prisma.staff_duty_roster.findUnique({
        where: { roster_id: String(req.params.rosterId) },
        select: { branch_id: true },
    });
    return row?.branch_id ?? "";
});

// -------------------------------------------------------------
// Availability Query (Used by Allocate Care Team dialog)
// -------------------------------------------------------------
router.get(
    "/available",
    authenticate,
    authorizeAny("admission.read", "ipd.duty_roster", "admission.care_team"),
    byQueryBranch,
    controller.getAvailableStaff.bind(controller)
);

// -------------------------------------------------------------
// Branch Shift Configurations
// -------------------------------------------------------------
router.get(
    "/branch-shifts",
    authenticate,
    authorizeAny("admission.read", "ipd.duty_roster"),
    byQueryBranch,
    controller.getBranchShifts.bind(controller)
);

router.post(
    "/branch-shifts",
    authenticate,
    authorize("ipd.duty_roster"),
    adminWrite,
    byBodyBranch,
    controller.createBranchShift.bind(controller)
);

router.patch(
    "/branch-shifts/:shiftId",
    authenticate,
    authorize("ipd.duty_roster"),
    adminWrite,
    byShiftRecord,
    controller.updateBranchShift.bind(controller)
);

// -------------------------------------------------------------
// Weekly Recurring Templates
// -------------------------------------------------------------
router.get(
    "/templates",
    authenticate,
    authorizeAny("admission.read", "ipd.duty_roster"),
    byQueryBranch,
    controller.getTemplates.bind(controller)
);

router.post(
    "/templates",
    authenticate,
    authorize("ipd.duty_roster"),
    adminWrite,
    byBodyBranch,
    controller.upsertTemplate.bind(controller)
);

router.delete(
    "/templates/:templateId",
    authenticate,
    authorize("ipd.duty_roster"),
    adminWrite,
    byTemplateRecord,
    controller.deleteTemplate.bind(controller)
);

// -------------------------------------------------------------
// Date-specific Duty Roster Entries
// -------------------------------------------------------------
router.get(
    "/roster",
    authenticate,
    authorizeAny("admission.read", "ipd.duty_roster"),
    byQueryBranch,
    controller.getRoster.bind(controller)
);

router.post(
    "/roster",
    authenticate,
    authorize("ipd.duty_roster"),
    adminWrite,
    byBodyBranch,
    controller.upsertRosterEntry.bind(controller)
);

router.delete(
    "/roster/:rosterId",
    authenticate,
    authorize("ipd.duty_roster"),
    adminWrite,
    byRosterRecord,
    controller.deleteRosterEntry.bind(controller)
);

export default router;
