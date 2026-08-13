"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCTOR_TRANSFER_ROLES = void 0;
const express_1 = require("express");
const doctorTransfer_controller_1 = require("./doctorTransfer.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const authorize_2 = require("../../middleware/authorize");
const roles_1 = require("../../permissions/roles");
const doctorTransfer_validation_1 = require("./doctorTransfer.validation");
// Re-exported for appointment.routes.ts, which reuses this same role set
// for its doctor-transfer-related endpoints.
exports.DOCTOR_TRANSFER_ROLES = roles_1.BRANCH_ADMIN_ROLES;
const router = (0, express_1.Router)();
const controller = new doctorTransfer_controller_1.DoctorTransferController();
router.post("/:employeeId/transfer", auth_middleware_1.authenticate, (0, authorize_1.authorize)("doctor.transfer"), (0, authorize_2.authorizeRoles)(...exports.DOCTOR_TRANSFER_ROLES), doctorTransfer_validation_1.initiateTransferValidation, controller.initiateTransfer.bind(controller));
router.post("/:employeeId/transfer/confirm", auth_middleware_1.authenticate, (0, authorize_1.authorize)("doctor.transfer"), (0, authorize_2.authorizeRoles)(...exports.DOCTOR_TRANSFER_ROLES), doctorTransfer_validation_1.confirmTransferValidation, controller.confirmTransfer.bind(controller));
router.get("/:employeeId/future-appointments", auth_middleware_1.authenticate, (0, authorize_1.authorize)("doctor.transfer"), (0, authorize_2.authorizeRoles)(...exports.DOCTOR_TRANSFER_ROLES), doctorTransfer_validation_1.getFutureAppointmentsValidation, controller.getFutureAppointments.bind(controller));
exports.default = router;
