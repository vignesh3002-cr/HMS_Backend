"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const doctorSchedule_controller_1 = require("./doctorSchedule.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const prisma_1 = __importDefault(require("../../config/prisma"));
const router = (0, express_1.Router)();
/**
 * Create ADD / OVERRIDE / CANCEL schedule change
 *
 * POST /change
 *
 * The doctor may only create changes for their OWN employee_id; admins may
 * create changes for any doctor. Everyone else is denied.
 */
router.post("/change", auth_middleware_1.authenticate, (0, authorize_1.authorizeScheduleChange)((req) => req.body.employee_id), doctorSchedule_controller_1.doctorScheduleController.createScheduleChange);
/**
 * Get all recurring weekly schedules for a doctor,
 * including inactive rows
 *
 * GET /:employeeId/recurring?branch_id=
 */
router.get("/:employeeId/recurring", doctorSchedule_controller_1.doctorScheduleController.getRecurringSchedules);
/**
 * Toggle the recurring weekly schedule for a
 * doctor + branch + day_of_week on/off
 *
 * PATCH /recurring/toggle
 */
router.patch("/recurring/toggle", doctorSchedule_controller_1.doctorScheduleController.toggleRecurringDay);
/**
 * Add a single recurring slot to the doctor_schedule template
 * (applies to every upcoming occurrence of that weekday)
 *
 * POST /recurring/slot/:employeeId
 */
router.post("/recurring/slot/:employeeId", doctorSchedule_controller_1.doctorScheduleController.createRecurringSlot);
/**
 * Soft-close a single recurring slot in the doctor_schedule template
 *
 * DELETE /recurring/slot/:employeeId/:scheduleId
 */
router.delete("/recurring/slot/:employeeId/:scheduleId", doctorSchedule_controller_1.doctorScheduleController.deleteRecurringSlot);
/**
 * Get all active schedule changes for a doctor
 *
 * GET /:employeeId/changes
 *
 * Doctors may only list their OWN changes; admins may list any doctor's.
 */
router.get("/:employeeId/changes", auth_middleware_1.authenticate, (0, authorize_1.authorizeScheduleChange)((req) => String(req.params.employeeId)), doctorSchedule_controller_1.doctorScheduleController.getDoctorScheduleChanges);
/**
 * Get schedule changes for a doctor on a specific date
 *
 * GET /:employeeId/changes/:date
 */
router.get("/:employeeId/changes/:date", auth_middleware_1.authenticate, (0, authorize_1.authorizeScheduleChange)((req) => String(req.params.employeeId)), doctorSchedule_controller_1.doctorScheduleController.getScheduleChangesByDate);
/**
 * Update an existing schedule change
 *
 * PATCH /change/:changeId
 *
 * The target doctor is resolved from the change record itself, so a doctor
 * can never edit another doctor's schedule change.
 */
router.patch("/change/:changeId", auth_middleware_1.authenticate, (0, authorize_1.authorizeScheduleChange)(async (req) => {
    const change = await prisma_1.default.doctor_schedule_change.findUnique({
        where: { change_id: BigInt(String(req.params.changeId)) },
        select: { employee_id: true },
    });
    return change?.employee_id ?? "";
}), doctorSchedule_controller_1.doctorScheduleController.updateScheduleChange);
/**
 * Deactivate a schedule change
 *
 * PATCH /change/:changeId/cancel
 */
router.patch("/change/:changeId/cancel", auth_middleware_1.authenticate, (0, authorize_1.authorizeScheduleChange)(async (req) => {
    const change = await prisma_1.default.doctor_schedule_change.findUnique({
        where: { change_id: BigInt(String(req.params.changeId)) },
        select: { employee_id: true },
    });
    return change?.employee_id ?? "";
}), doctorSchedule_controller_1.doctorScheduleController.cancelScheduleChange);
exports.default = router;
