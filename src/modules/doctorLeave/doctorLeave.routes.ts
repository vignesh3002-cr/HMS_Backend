import { Router, RequestHandler } from "express";
import { validationResult } from "express-validator";
import { DoctorLeaveController } from "./doctorLeave.controller";
import {
    applyDoctorLeaveValidation,
    approveDoctorLeaveValidation,
    rejectDoctorLeaveValidation,
    getDoctorLeaveValidation,
    queueRescheduleValidation,
    getLeaveConflictsValidation
} from "./doctorLeave.validation";
import { authenticate } from "../auth/auth.middleware";
import {
    authorizeRoles,
    authorizeScheduleChange,
} from "../../middleware/authorize";

const router = Router();
const controller = new DoctorLeaveController();

// Admins may act for any doctor; a doctor may act only on their own record.
const adminOrSelf = authorizeScheduleChange((req) =>
    String(req.params?.employeeId ?? "")
);
// Only admins decide on leave requests.
const adminOnly = authorizeRoles(
    "SUPER_ADMIN",
    "HEAD_ADMIN",
    "ADMIN",
    "BRANCH_ADMIN"
);

// Reject the request when any express-validator rule failed.
const rejectInvalid: RequestHandler = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: errors.array()[0].msg,
            errors: errors.array(),
        });
    }
    next();
};

// Apply Leave
router.post(
    "/:employeeId/apply",
    authenticate,
    adminOrSelf,
    applyDoctorLeaveValidation,
    rejectInvalid,
    controller.applyLeave
);

// Queue a doctor's appointments (inside a date range) for reschedule
router.post(
    "/:employeeId/queue-reschedule",
    authenticate,
    adminOrSelf,
    queueRescheduleValidation,
    controller.queueRescheduleForLeave
);

// Active appointments inside a leave date range (conflict pre-check)
router.get(
    "/:employeeId/conflicts",
    authenticate,
    adminOrSelf,
    getLeaveConflictsValidation,
    controller.getLeaveConflicts
);

// Approve Leave
router.patch(
    "/:leaveId/approve",
    authenticate,
    adminOnly,
    approveDoctorLeaveValidation,
    rejectInvalid,
    controller.approveLeave
);

// Reject Leave
router.patch(
    "/:leaveId/reject",
    authenticate,
    adminOnly,
    rejectDoctorLeaveValidation,
    rejectInvalid,
    controller.rejectLeave
);

// Get Leave List
router.get(
    "/",
    authenticate,
    getDoctorLeaveValidation,
    rejectInvalid,
    controller.getDoctorLeaves
);

export default router;