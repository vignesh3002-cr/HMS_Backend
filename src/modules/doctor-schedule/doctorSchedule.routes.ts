import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { authorizeScheduleChange } from "../../middleware/authorize";
import prisma from "../../config/prisma";

import { doctorScheduleController } from "./doctorSchedule.controller";

const router = Router();

// Writes: only admins, or the doctor acting on their OWN schedule.
const byBodyEmployee = authorizeScheduleChange((req) =>
    String(req.body?.employee_id ?? "")
);
const byParamEmployee = authorizeScheduleChange((req) =>
    String(req.params?.employeeId ?? "")
);
const byChangeRecord = authorizeScheduleChange(async (req) => {
    const changeId = String(req.params?.changeId ?? "");
    if (!/^\d+$/.test(changeId)) return "";
    const change = await prisma.doctor_schedule_change.findUnique({
        where: { change_id: BigInt(changeId) },
        select: { employee_id: true },
    });
    return change?.employee_id ?? "";
});

/**
 * Create ADD / OVERRIDE / CANCEL schedule change
 *
 * POST /change
 */
router.post(
    "/change",
    authenticate,
    byBodyEmployee,
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
    byBodyEmployee,
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
    byParamEmployee,
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
    byParamEmployee,
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
    byParamEmployee,
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
    byChangeRecord,
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
    byChangeRecord,
    doctorScheduleController.cancelScheduleChange
);

export default router;
