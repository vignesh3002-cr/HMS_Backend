"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const doctorSchedule_controller_1 = require("./doctorSchedule.controller");
const router = (0, express_1.Router)();
/**
 * Create ADD / OVERRIDE / CANCEL schedule change
 *
 * POST /change
 */
router.post("/change", doctorSchedule_controller_1.doctorScheduleController.createScheduleChange);
/**
 * Get all active schedule changes for a doctor
 *
 * GET /:employeeId/changes
 */
router.get("/:employeeId/changes", doctorSchedule_controller_1.doctorScheduleController.getDoctorScheduleChanges);
/**
 * Get schedule changes for a doctor on a specific date
 *
 * GET /:employeeId/changes/:date
 */
router.get("/:employeeId/changes/:date", doctorSchedule_controller_1.doctorScheduleController.getScheduleChangesByDate);
/**
 * Update an existing schedule change
 *
 * PATCH /change/:changeId
 */
router.patch("/change/:changeId", doctorSchedule_controller_1.doctorScheduleController.updateScheduleChange);
/**
 * Deactivate a schedule change
 *
 * PATCH /change/:changeId/cancel
 */
router.patch("/change/:changeId/cancel", doctorSchedule_controller_1.doctorScheduleController.cancelScheduleChange);
exports.default = router;
