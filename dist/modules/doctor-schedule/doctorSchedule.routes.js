"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const doctorSchedule_controller_1 = require("./doctorSchedule.controller");
const router = (0, express_1.Router)();
/**
 * Create ADD / OVERRIDE / CANCEL schedule change
 *
 * POST /change
 */
router.post("/change", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.createScheduleChange);
/**
 * Get all recurring weekly schedules for a doctor,
 * including inactive rows
 *
 * GET /:employeeId/recurring?branch_id=
 */
router.get("/:employeeId/recurring", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.getRecurringSchedules);
/**
 * Toggle the recurring weekly schedule for a
 * doctor + branch + day_of_week on/off
 *
 * PATCH /recurring/toggle
 */
router.patch("/recurring/toggle", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.toggleRecurringDay);
/**
 * Add a single recurring slot to the doctor_schedule template
 * (applies to every upcoming occurrence of that weekday)
 *
 * POST /recurring/slot/:employeeId
 */
router.post("/recurring/slot/:employeeId", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.createRecurringSlot);
/**
 * Soft-close a single recurring slot in the doctor_schedule template
 *
 * DELETE /recurring/slot/:employeeId/:scheduleId
 */
router.delete("/recurring/slot/:employeeId/:scheduleId", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.deleteRecurringSlot);
/**
 * Update a single recurring slot in the doctor_schedule template
 *
 * PUT /recurring/slot/:employeeId/:scheduleId
 */
router.put("/recurring/slot/:employeeId/:scheduleId", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.updateRecurringSlot);
/**
 * Get all active schedule changes for a doctor
 *
 * GET /:employeeId/changes
 */
router.get("/:employeeId/changes", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.getDoctorScheduleChanges);
/**
 * Get schedule changes for a doctor on a specific date
 *
 * GET /:employeeId/changes/:date
 */
router.get("/:employeeId/changes/:date", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.getScheduleChangesByDate);
/**
 * Update an existing schedule change
 *
 * PATCH /change/:changeId
 */
router.patch("/change/:changeId", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.updateScheduleChange);
/**
 * Deactivate a schedule change
 *
 * PATCH /change/:changeId/cancel
 */
router.patch("/change/:changeId/cancel", auth_middleware_1.authenticate, doctorSchedule_controller_1.doctorScheduleController.cancelScheduleChange);
exports.default = router;
