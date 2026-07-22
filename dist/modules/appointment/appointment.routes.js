"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointment_controller_1 = require("./appointment.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const appointment_validation_1 = require("./appointment.validation");
const router = (0, express_1.Router)();
const controller = new appointment_controller_1.AppointmentController();
router.post("/", auth_middleware_1.authenticate, appointment_validation_1.createAppointmentValidation, controller.createAppointment.bind(controller));
router.get("/", auth_middleware_1.authenticate, appointment_validation_1.getAppointmentsValidation, controller.getAppointments.bind(controller));
router.get("/:appointmentNo", auth_middleware_1.authenticate, controller.getAppointmentByNumber.bind(controller));
router.put("/:appointmentNo", auth_middleware_1.authenticate, appointment_validation_1.updateAppointmentValidation, controller.updateAppointment.bind(controller));
router.patch("/:appointmentNo/status", auth_middleware_1.authenticate, appointment_validation_1.updateAppointmentStatusValidation, controller.updateAppointmentStatus.bind(controller));
// Soft cancellation only - appointments are never physically deleted.
router.delete("/:appointmentNo", auth_middleware_1.authenticate, controller.cancelAppointment.bind(controller));
exports.default = router;
