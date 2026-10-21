"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const doctorLeave_controller_1 = require("./doctorLeave.controller");
const doctorLeave_validation_1 = require("./doctorLeave.validation");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const router = (0, express_1.Router)();
const controller = new doctorLeave_controller_1.DoctorLeaveController();
// Admins may act for any doctor; a doctor may act only on their own record.
const adminOrSelf = (0, authorize_1.authorizeScheduleChange)((req) => String(req.params?.employeeId ?? ""));
// Only admins decide on leave requests.
const adminOnly = (0, authorize_1.authorizeRoles)("SUPER_ADMIN", "HEAD_ADMIN", "ADMIN", "BRANCH_ADMIN");
// Reject the request when any express-validator rule failed.
const rejectInvalid = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
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
router.post("/:employeeId/apply", auth_middleware_1.authenticate, adminOrSelf, doctorLeave_validation_1.applyDoctorLeaveValidation, rejectInvalid, controller.applyLeave);
// Queue a doctor's appointments (inside a date range) for reschedule
router.post("/:employeeId/queue-reschedule", auth_middleware_1.authenticate, adminOrSelf, doctorLeave_validation_1.queueRescheduleValidation, controller.queueRescheduleForLeave);
// Active appointments inside a leave date range (conflict pre-check)
router.get("/:employeeId/conflicts", auth_middleware_1.authenticate, adminOrSelf, doctorLeave_validation_1.getLeaveConflictsValidation, controller.getLeaveConflicts);
// Approve Leave
router.patch("/:leaveId/approve", auth_middleware_1.authenticate, adminOnly, doctorLeave_validation_1.approveDoctorLeaveValidation, rejectInvalid, controller.approveLeave);
// Reject Leave
router.patch("/:leaveId/reject", auth_middleware_1.authenticate, adminOnly, doctorLeave_validation_1.rejectDoctorLeaveValidation, rejectInvalid, controller.rejectLeave);
// Get Leave List
router.get("/", auth_middleware_1.authenticate, doctorLeave_validation_1.getDoctorLeaveValidation, rejectInvalid, controller.getDoctorLeaves);
exports.default = router;
