import { Router } from "express";

import { doctorScheduleController } from "./doctorSchedule.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorizeScheduleChange } from "../../middleware/authorize";
import prisma from "../../config/prisma";

const router = Router();

/**
 * Create ADD / OVERRIDE / CANCEL schedule change
 *
 * POST /change
 *
 * The doctor may only create changes for their OWN employee_id; admins may
 * create changes for any doctor. Everyone else is denied.
 */
router.post(
    "/change",
    authenticate,
    authorizeScheduleChange((req) => req.body.employee_id),
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
 *
 * Doctors may only list their OWN changes; admins may list any doctor's.
 */
router.get(
    "/:employeeId/changes",
    authenticate,
    authorizeScheduleChange((req) => String(req.params.employeeId)),
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
    authorizeScheduleChange((req) => String(req.params.employeeId)),
    doctorScheduleController.getScheduleChangesByDate
);

/**
 * Update an existing schedule change
 *
 * PATCH /change/:changeId
 *
 * The target doctor is resolved from the change record itself, so a doctor
 * can never edit another doctor's schedule change.
 */
router.patch(
    "/change/:changeId",
    authenticate,
    authorizeScheduleChange(async (req) => {
        const change = await prisma.doctor_schedule_change.findUnique({
            where: { change_id: BigInt(String(req.params.changeId)) },
            select: { employee_id: true },
        });

        return change?.employee_id ?? "";
    }),
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
    authorizeScheduleChange(async (req) => {
        const change = await prisma.doctor_schedule_change.findUnique({
            where: { change_id: BigInt(String(req.params.changeId)) },
            select: { employee_id: true },
        });

        return change?.employee_id ?? "";
    }),
    doctorScheduleController.cancelScheduleChange
);

export default router;