import { Router } from "express";
import { DoctorTransferController } from "./doctorTransfer.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    initiateTransferValidation,
    confirmTransferValidation,
    getFutureAppointmentsValidation
} from "./doctorTransfer.validation";

// Same admin-role set used for other sensitive branch-admin actions
// (see branch.routes.ts's TOP_LEVEL_ADMIN_ROLES), extended with BRANCH_ADMIN
// so a branch's own admin can transfer doctors in/out without a top-level admin.
export const DOCTOR_TRANSFER_ROLES = ["ADMIN", "Admin", "HEAD_ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"];

const router = Router();

const controller = new DoctorTransferController();

router.post(
    "/:employeeId/transfer",
    authenticate,
    authorize(...DOCTOR_TRANSFER_ROLES),
    initiateTransferValidation,
    controller.initiateTransfer.bind(controller)
);

router.post(
    "/:employeeId/transfer/confirm",
    authenticate,
    authorize(...DOCTOR_TRANSFER_ROLES),
    confirmTransferValidation,
    controller.confirmTransfer.bind(controller)
);

router.get(
    "/:employeeId/future-appointments",
    authenticate,
    authorize(...DOCTOR_TRANSFER_ROLES),
    getFutureAppointmentsValidation,
    controller.getFutureAppointments.bind(controller)
);

export default router;
