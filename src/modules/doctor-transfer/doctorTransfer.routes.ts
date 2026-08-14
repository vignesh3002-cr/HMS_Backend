import { Router } from "express";
import { DoctorTransferController } from "./doctorTransfer.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorizeRoles,authorize } from "../../middleware/authorize";
import { BRANCH_ADMIN_ROLES } from "../../permissions/roles";
import {
    initiateTransferValidation,
    confirmTransferValidation,
    getFutureAppointmentsValidation
} from "./doctorTransfer.validation";

// Re-exported for appointment.routes.ts, which reuses this same role set
// for its doctor-transfer-related endpoints.
export const DOCTOR_TRANSFER_ROLES = BRANCH_ADMIN_ROLES;

const router = Router();

const controller = new DoctorTransferController();

router.post(
    "/:employeeId/transfer",
    authenticate,
    authorize("doctor.transfer"),
    authorizeRoles(...DOCTOR_TRANSFER_ROLES),
    initiateTransferValidation,
    controller.initiateTransfer.bind(controller)
);

router.post(
    "/:employeeId/transfer/confirm",
    authenticate,
    authorize("doctor.transfer"),
    authorizeRoles(...DOCTOR_TRANSFER_ROLES),
    confirmTransferValidation,
    controller.confirmTransfer.bind(controller)
);

router.get(
    "/:employeeId/future-appointments",
    authenticate,
    authorize("doctor.transfer"),
    authorizeRoles(...DOCTOR_TRANSFER_ROLES),
    getFutureAppointmentsValidation,
    controller.getFutureAppointments.bind(controller)
);

export default router;
