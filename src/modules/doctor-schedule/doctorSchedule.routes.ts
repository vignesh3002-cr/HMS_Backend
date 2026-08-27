import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";

import { doctorScheduleController } from "./doctorSchedule.controller";

const router = Router();

/**
 * Create ADD / OVERRIDE / CANCEL schedule change
 *
 * POST /change
 */
router.post(
    "/change",
    authenticate,
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
    authenticate,
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
    authenticate,
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
    authenticate,
    doctorScheduleController.createRecurringSlot
);

/**
 * Soft-close a single recurring slot in the doctor_schedule template
 *
 * DELETE /recurring/slot/:employeeId/:scheduleId
 */
router.delete(
    "/recurring/slot/:employeeId/:scheduleId",
    authenticate,
    doctorScheduleController.deleteRecurringSlot
);

/**
 * Update a single recurring slot in the doctor_schedule template
 *
 * PUT /recurring/slot/:employeeId/:scheduleId
 */
router.put(
    "/recurring/slot/:employeeId/:scheduleId",
    authenticate,
    doctorScheduleController.updateRecurringSlot
);

/**
 * Get all active schedule changes for a doctor
 *
 * GET /:employeeId/changes
 */
router.get(
    "/:employeeId/changes",
    authenticate,
    doctorScheduleController.getDoctorScheduleChanges
);

/**
 * Get schedule changes for a doctor on a specific date
 *
 * GET /:employeeId/changes/:date
 */
router.get(
    "/:employeeId/changes/:date",
    authenticate,
    doctorScheduleController.getScheduleChangesByDate
);

/**
 * Update an existing schedule change
 *
 * PATCH /change/:changeId
 */
router.patch(
    "/change/:changeId",
    authenticate,
    doctorScheduleController.updateScheduleChange
);

/**
 * Deactivate a schedule change
 *
 * PATCH /change/:changeId/cancel
 */
router.patch(
    "/change/:changeId/cancel",
    authenticate,
    doctorScheduleController.cancelScheduleChange
);

export default router;