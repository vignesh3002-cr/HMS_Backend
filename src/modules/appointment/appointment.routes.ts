import { Router } from "express";
import { AppointmentController } from "./appointment.controller";
import { authenticate } from "../auth/auth.middleware";
<<<<<<< HEAD
import { authorize } from "../../middleware/authorize";
=======
import { authorize, authorizeRoles } from "../../middleware/authorize";
import { branchScope } from "../../middleware/branchScope";
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
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
<<<<<<< HEAD
    authorize(...DOCTOR_TRANSFER_ROLES),
=======
    authorizeRoles(...DOCTOR_TRANSFER_ROLES),
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
    getRescheduleQueueValidation,
    transferController.getRescheduleQueue.bind(transferController)
);

router.put(
    "/reschedule/:appointmentId",
    authenticate,
<<<<<<< HEAD
    authorize(...DOCTOR_TRANSFER_ROLES),
=======
    authorizeRoles(...DOCTOR_TRANSFER_ROLES),
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
    processRescheduleActionValidation,
    transferController.processRescheduleAction.bind(transferController)
);

router.post(
    "/transfer-preview",
    authenticate,
<<<<<<< HEAD
    authorize(...DOCTOR_TRANSFER_ROLES),
=======
    authorizeRoles(...DOCTOR_TRANSFER_ROLES),
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
    transferPreviewValidation,
    transferController.transferPreview.bind(transferController)
);

router.post(
    "/",
    authenticate,
    authorize("appointment.create"),
    createAppointmentValidation,
    controller.createAppointment.bind(controller)
);

router.get(
    "/",
    authenticate,
    authorize("appointment.read"),
    branchScope,
    getAppointmentsValidation,
    controller.getAppointments.bind(controller)
);

router.get(
    "/available-slots",
    authenticate,
    authorize("appointment.read"),
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
    authorize("appointment.read"),
    controller.getAppointmentByNumber.bind(controller)
);

router.put(
    "/:appointmentNo",
    authenticate,
    authorize("appointment.update"),
    updateAppointmentValidation,
    controller.updateAppointment.bind(controller)
);

router.patch(
    "/:appointmentNo/status",
    authenticate,
    authorize("appointment.update"),
    updateAppointmentStatusValidation,
    controller.updateAppointmentStatus.bind(controller)
);

// Soft cancellation only - appointments are never physically deleted.
router.delete(
    "/:appointmentNo",
    authenticate,
    authorize("appointment.cancel"),
    cancelAppointmentValidation,
    controller.cancelAppointment.bind(controller)
);

export default router;
