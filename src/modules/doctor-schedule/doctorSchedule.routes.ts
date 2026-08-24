import { Router } from "express";

import { doctorScheduleController } from "./doctorSchedule.controller";

const router = Router();

/**
 * Create ADD / OVERRIDE / CANCEL schedule change
 *
 * POST /change
 */
router.post(
    "/change",
    doctorScheduleController.createScheduleChange
);

/**
 * Get all recurring weekly schedules for a doctor,
 * including inactive rows
 *
 * GET /:employeeId/recurring?branch_id=
 */
router.get(
    "/:employeeId/recurring",
    doctorScheduleController.getRecurringSchedules
);

/**
 * Toggle the recurring weekly schedule for a
 * doctor + branch + day_of_week on/off
 *
 * PATCH /recurring/toggle
 */
router.patch(
    "/recurring/toggle",
    doctorScheduleController.toggleRecurringDay
);

/**
 * Add a single recurring slot to the doctor_schedule template
 * (applies to every upcoming occurrence of that weekday)
 *
 * POST /recurring/slot/:employeeId
 */
router.post(
    "/recurring/slot/:employeeId",
    doctorScheduleController.createRecurringSlot
);

/**
 * Soft-close a single recurring slot in the doctor_schedule template
 *
 * DELETE /recurring/slot/:employeeId/:scheduleId
 */
router.delete(
    "/recurring/slot/:employeeId/:scheduleId",
    doctorScheduleController.deleteRecurringSlot
);

/**
 * Get all active schedule changes for a doctor
 *
 * GET /:employeeId/changes
 */
router.get(
    "/:employeeId/changes",
    doctorScheduleController.getDoctorScheduleChanges
);

/**
 * Get schedule changes for a doctor on a specific date
 *
 * GET /:employeeId/changes/:date
 */
router.get(
    "/:employeeId/changes/:date",
    doctorScheduleController.getScheduleChangesByDate
);

/**
 * Update an existing schedule change
 *
 * PATCH /change/:changeId
 */
router.patch(
    "/change/:changeId",
    doctorScheduleController.updateScheduleChange
);

/**
 * Deactivate a schedule change
 *
 * PATCH /change/:changeId/cancel
 */
router.patch(
    "/change/:changeId/cancel",
    doctorScheduleController.cancelScheduleChange
);

export default router;