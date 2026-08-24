"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const doctorLeave_controller_1 = require("./doctorLeave.controller");
const doctorLeave_validation_1 = require("./doctorLeave.validation");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
const controller = new doctorLeave_controller_1.DoctorLeaveController();
// Apply Leave
router.post("/:employeeId/apply", auth_middleware_1.authenticate, doctorLeave_validation_1.applyDoctorLeaveValidation, controller.applyLeave);
// Queue a doctor's appointments (inside a date range) for reschedule
router.post("/:employeeId/queue-reschedule", auth_middleware_1.authenticate, doctorLeave_validation_1.queueRescheduleValidation, controller.queueRescheduleForLeave);
// Active appointments inside a leave date range (conflict pre-check)
router.get("/:employeeId/conflicts", auth_middleware_1.authenticate, doctorLeave_validation_1.getLeaveConflictsValidation, controller.getLeaveConflicts);
// Approve Leave
router.patch("/:leaveId/approve", auth_middleware_1.authenticate, doctorLeave_validation_1.approveDoctorLeaveValidation, controller.approveLeave);
// Reject Leave
router.patch("/:leaveId/reject", auth_middleware_1.authenticate, doctorLeave_validation_1.rejectDoctorLeaveValidation, controller.rejectLeave);
// Get Leave List
router.get("/", auth_middleware_1.authenticate, doctorLeave_validation_1.getDoctorLeaveValidation, controller.getDoctorLeaves);
exports.default = router;
