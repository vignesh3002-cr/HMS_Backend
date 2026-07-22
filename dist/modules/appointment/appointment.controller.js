"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentController = void 0;
const express_validator_1 = require("express-validator");
const appointment_service_1 = require("./appointment.service");
const service = new appointment_service_1.AppointmentService();
class AppointmentController {
    async createAppointment(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const createdBy = req.user?.role || "SYSTEM";
            const appointment = await service.bookAppointment(req.body, createdBy);
            return res.status(201).json({
                success: true,
                message: "Appointment booked successfully",
                data: appointment
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getAppointments(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const appointments = await service.getAppointments({
                branchId: req.query.branchId,
                employeeId: req.query.employeeId,
                patientId: req.query.patientId,
                status: req.query.status,
                date: req.query.date,
                dateFrom: req.query.dateFrom,
                dateTo: req.query.dateTo,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10)
            });
            return res.json({
                success: true,
                message: "Appointments fetched successfully",
                data: appointments
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getAppointmentByNumber(req, res) {
        try {
            const appointment = await service.getAppointmentByNumber(req.params.appointmentNo);
            return res.json({
                success: true,
                message: "Appointment fetched successfully",
                data: appointment
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async updateAppointment(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const appointment = await service.updateAppointment(req.params.appointmentNo, req.body);
            return res.json({
                success: true,
                message: "Appointment updated successfully",
                data: appointment
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async updateAppointmentStatus(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const appointment = await service.updateAppointmentStatus(req.params.appointmentNo, req.body.status);
            return res.json({
                success: true,
                message: "Appointment status updated successfully",
                data: appointment
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async cancelAppointment(req, res) {
        try {
            const appointment = await service.cancelAppointment(req.params.appointmentNo);
            return res.json({
                success: true,
                message: "Appointment cancelled successfully",
                data: appointment
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}
exports.AppointmentController = AppointmentController;
