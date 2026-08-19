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