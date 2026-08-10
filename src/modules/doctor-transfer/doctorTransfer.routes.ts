import { Router } from "express";
import { DoctorTransferController } from "./doctorTransfer.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    initiateTransferValidation,
    confirmTransferValidation,
    getFutureAppointmentsValidation
} from "./doctorTransfer.validation";

const router = Router();

const controller = new DoctorTransferController();

router.post(
    "/:employeeId/transfer",
    authenticate,
    authorize("doctor.transfer"),
    initiateTransferValidation,
    controller.initiateTransfer.bind(controller)
);

router.post(
    "/:employeeId/transfer/confirm",
    authenticate,
    authorize("doctor.transfer"),
    confirmTransferValidation,
    controller.confirmTransfer.bind(controller)
);

router.get(
    "/:employeeId/future-appointments",
    authenticate,
    authorize("doctor.transfer"),
    getFutureAppointmentsValidation,
    controller.getFutureAppointments.bind(controller)
);

export default router;
