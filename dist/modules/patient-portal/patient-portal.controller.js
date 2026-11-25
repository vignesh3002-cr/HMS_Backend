"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientPortalController = void 0;
const patient_portal_service_1 = require("./patient-portal.service");
const service = new patient_portal_service_1.PatientPortalService();
class PatientPortalController {
    async getDashboard(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const data = await service.getDashboard(patientId);
            return res.status(200).json({
                success: true,
                data,
            });
        }
        catch (err) {
            return res.status(err.message?.includes("not found") ? 404 : 500).json({
                success: false,
                message: err.message || "Failed to load patient dashboard",
            });
        }
    }
    async getAppointments(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const data = await service.getAppointments(patientId);
            return res.status(200).json({
                success: true,
                data,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to load appointments",
            });
        }
    }
    async getLabReports(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const data = await service.getLabReports(patientId);
            return res.status(200).json({
                success: true,
                data,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to load lab reports",
            });
        }
    }
    async getPrescriptions(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const data = await service.getPrescriptions(patientId);
            return res.status(200).json({
                success: true,
                data,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to load prescriptions",
            });
        }
    }
    async getVitalsHistory(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const data = await service.getVitalsHistory(patientId);
            return res.status(200).json({
                success: true,
                data,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to load vitals history",
            });
        }
    }
    async getChemotherapyPlans(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const data = await service.getChemotherapyPlans(patientId);
            return res.status(200).json({
                success: true,
                data,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to load chemotherapy plans",
            });
        }
    }
    async getBranches(req, res) {
        try {
            const branches = await service.getBranches();
            return res.status(200).json({
                success: true,
                data: branches,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to fetch branches",
            });
        }
    }
    async getDepartments(req, res) {
        try {
            const branchId = req.query.branchId;
            const departments = await service.getDepartments(branchId);
            return res.status(200).json({
                success: true,
                data: departments,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to fetch departments",
            });
        }
    }
    async getDoctors(req, res) {
        try {
            const branchId = req.query.branchId;
            const departmentId = req.query.departmentId;
            const doctors = await service.getDoctors({ branchId, departmentId });
            return res.status(200).json({
                success: true,
                data: doctors,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to fetch doctors",
            });
        }
    }
    async getAvailableSlots(req, res) {
        try {
            const employeeId = req.query.employeeId;
            const branchId = req.query.branchId;
            const date = req.query.date;
            if (!employeeId || !branchId || !date) {
                return res.status(400).json({
                    success: false,
                    message: "employeeId, branchId, and date are required query parameters",
                });
            }
            const slotsResult = await service.getAvailableSlots(employeeId, branchId, date);
            return res.status(200).json({
                success: true,
                data: slotsResult,
            });
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message || "Failed to fetch available slots",
            });
        }
    }
    async bookAppointment(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const appointment = await service.bookAppointment(patientId, req.body, req.user);
            return res.status(201).json({
                success: true,
                message: "Appointment booked successfully",
                data: appointment,
            });
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message || "Failed to book appointment",
            });
        }
    }
    async cancelAppointment(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const { appointmentId } = req.params;
            const { reason } = req.body;
            const cancelled = await service.cancelAppointment(patientId, String(appointmentId), reason);
            return res.status(200).json({
                success: true,
                message: "Appointment cancelled successfully",
                data: cancelled,
            });
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message || "Failed to cancel appointment",
            });
        }
    }
    async rescheduleAppointment(req, res) {
        try {
            const patientId = await service.resolvePatientId(req.user);
            const { appointmentId } = req.params;
            const updated = await service.rescheduleAppointment(patientId, String(appointmentId), req.body, req.user);
            return res.status(200).json({
                success: true,
                message: "Appointment rescheduled successfully",
                data: updated,
            });
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message || "Failed to reschedule appointment",
            });
        }
    }
}
exports.PatientPortalController = PatientPortalController;
