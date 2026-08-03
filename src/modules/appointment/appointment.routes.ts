import { Router } from "express";
import { AppointmentController } from "./appointment.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createAppointmentValidation,
    updateAppointmentValidation,
    updateAppointmentStatusValidation,
    getAppointmentsValidation,
    getAvailableSlotsValidation,
    getDoctorSlotSummaryValidation,
    getDoctorWeekSlotSummaryValidation,
    cancelAppointmentValidation
} from "./appointment.validation";
import { DoctorTransferController } from "../doctor-transfer/doctorTransfer.controller";
import { DOCTOR_TRANSFER_ROLES } from "../doctor-transfer/doctorTransfer.routes";
import {
    transferPreviewValidation,
    getRescheduleQueueValidation,
    processRescheduleActionValidation
} from "../doctor-transfer/doctorTransfer.validation";

const router = Router();

const controller = new AppointmentController();
const transferController = new DoctorTransferController();

// Doctor-transfer related routes - registered before the "/:appointmentNo"
// catch-all below so single-segment paths like "/reschedule-queue" aren't
// swallowed by it (same trap documented in branch.routes.ts).
router.get(
    "/reschedule-queue",
    authenticate,
    authorize(...DOCTOR_TRANSFER_ROLES),
    getRescheduleQueueValidation,
    transferController.getRescheduleQueue.bind(transferController)
);

router.put(
    "/reschedule/:appointmentId",
    authenticate,
    authorize(...DOCTOR_TRANSFER_ROLES),
    processRescheduleActionValidation,
    transferController.processRescheduleAction.bind(transferController)
);

router.post(
    "/transfer-preview",
    authenticate,
    authorize(...DOCTOR_TRANSFER_ROLES),
    transferPreviewValidation,
    transferController.transferPreview.bind(transferController)
);

router.post(
    "/",
    authenticate,
    createAppointmentValidation,
    controller.createAppointment.bind(controller)
);

router.get(
    "/",
    authenticate,
    getAppointmentsValidation,
    controller.getAppointments.bind(controller)
);

router.get(
    "/available-slots",
    authenticate,
    getAvailableSlotsValidation,
    controller.getAvailableSlots.bind(controller)
);

router.get(
    "/doctor-slot-summary",
    authenticate,
    getDoctorSlotSummaryValidation,
    controller.getDoctorSlotSummary.bind(controller)
);

router.get(
    "/doctor-week-slot-summary",
    authenticate,
    getDoctorWeekSlotSummaryValidation,
    controller.getDoctorWeekSlotSummary.bind(controller)
);

router.get(
    "/:appointmentNo",
    authenticate,
    controller.getAppointmentByNumber.bind(controller)
);

router.put(
    "/:appointmentNo",
    authenticate,
    updateAppointmentValidation,
    controller.updateAppointment.bind(controller)
);

router.patch(
    "/:appointmentNo/status",
    authenticate,
    updateAppointmentStatusValidation,
    controller.updateAppointmentStatus.bind(controller)
);

// Soft cancellation only - appointments are never physically deleted.
router.delete(
    "/:appointmentNo",
    authenticate,
    cancelAppointmentValidation,
    controller.cancelAppointment.bind(controller)
);

export default router;
