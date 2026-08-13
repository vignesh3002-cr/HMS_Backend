import { Router } from "express";
import { DoctorLeaveController } from "./doctorLeave.controller";
import {
    applyDoctorLeaveValidation,
    approveDoctorLeaveValidation,
    rejectDoctorLeaveValidation,
    getDoctorLeaveValidation
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