import { Router } from "express";
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

const router = Router();
const controller = new DoctorLeaveController();

// Apply Leave
router.post(
    "/:employeeId/apply",
    authenticate,
    applyDoctorLeaveValidation,
    controller.applyLeave
);

// Queue a doctor's appointments (inside a date range) for reschedule
router.post(
    "/:employeeId/queue-reschedule",
    authenticate,
    queueRescheduleValidation,
    controller.queueRescheduleForLeave
);

// Active appointments inside a leave date range (conflict pre-check)
router.get(
    "/:employeeId/conflicts",
    authenticate,
    getLeaveConflictsValidation,
    controller.getLeaveConflicts
);

// Approve Leave
router.patch(
    "/:leaveId/approve",
    authenticate,
    approveDoctorLeaveValidation,
    controller.approveLeave
);

// Reject Leave
router.patch(
    "/:leaveId/reject",
    authenticate,
    rejectDoctorLeaveValidation,
    controller.rejectLeave
);

// Get Leave List
router.get(
    "/",
    authenticate,
    getDoctorLeaveValidation,
    controller.getDoctorLeaves
);

export default router;