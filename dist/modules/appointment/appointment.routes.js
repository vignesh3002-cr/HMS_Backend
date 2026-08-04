"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointment_controller_1 = require("./appointment.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const branchScope_1 = require("../../middleware/branchScope");
const appointment_validation_1 = require("./appointment.validation");
const doctorTransfer_controller_1 = require("../doctor-transfer/doctorTransfer.controller");
const doctorTransfer_routes_1 = require("../doctor-transfer/doctorTransfer.routes");
const doctorTransfer_validation_1 = require("../doctor-transfer/doctorTransfer.validation");
const router = (0, express_1.Router)();
const controller = new appointment_controller_1.AppointmentController();
const transferController = new doctorTransfer_controller_1.DoctorTransferController();
// Doctor-transfer related routes - registered before the "/:appointmentNo"
// catch-all below so single-segment paths like "/reschedule-queue" aren't
// swallowed by it (same trap documented in branch.routes.ts).
router.get("/reschedule-queue", auth_middleware_1.authenticate, (0, authorize_1.authorizeRoles)(...doctorTransfer_routes_1.DOCTOR_TRANSFER_ROLES), doctorTransfer_validation_1.getRescheduleQueueValidation, transferController.getRescheduleQueue.bind(transferController));
router.put("/reschedule/:appointmentId", auth_middleware_1.authenticate, (0, authorize_1.authorizeRoles)(...doctorTransfer_routes_1.DOCTOR_TRANSFER_ROLES), doctorTransfer_validation_1.processRescheduleActionValidation, transferController.processRescheduleAction.bind(transferController));
router.post("/transfer-preview", auth_middleware_1.authenticate, (0, authorize_1.authorizeRoles)(...doctorTransfer_routes_1.DOCTOR_TRANSFER_ROLES), doctorTransfer_validation_1.transferPreviewValidation, transferController.transferPreview.bind(transferController));
router.post("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("appointment.create"), appointment_validation_1.createAppointmentValidation, controller.createAppointment.bind(controller));
router.get("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("appointment.read"), branchScope_1.branchScope, appointment_validation_1.getAppointmentsValidation, controller.getAppointments.bind(controller));
router.get("/available-slots", auth_middleware_1.authenticate, (0, authorize_1.authorize)("appointment.read"), appointment_validation_1.getAvailableSlotsValidation, controller.getAvailableSlots.bind(controller));
router.get("/:appointmentNo", auth_middleware_1.authenticate, (0, authorize_1.authorize)("appointment.read"), controller.getAppointmentByNumber.bind(controller));
router.put("/:appointmentNo", auth_middleware_1.authenticate, (0, authorize_1.authorize)("appointment.update"), appointment_validation_1.updateAppointmentValidation, controller.updateAppointment.bind(controller));
router.patch("/:appointmentNo/status", auth_middleware_1.authenticate, (0, authorize_1.authorize)("appointment.update"), appointment_validation_1.updateAppointmentStatusValidation, controller.updateAppointmentStatus.bind(controller));
// Soft cancellation only - appointments are never physically deleted.
router.delete("/:appointmentNo", auth_middleware_1.authenticate, (0, authorize_1.authorize)("appointment.cancel"), appointment_validation_1.cancelAppointmentValidation, controller.cancelAppointment.bind(controller));
exports.default = router;
