"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncounterController = void 0;
const express_validator_1 = require("express-validator");
const encounter_service_1 = require("./encounter.service");
const service = new encounter_service_1.EncounterService();
class EncounterController {
    async createEncounter(req, res) {
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
            const encounter = await service.createEncounter(req.body, createdBy);
            return res.status(201).json({
                success: true,
                message: "Encounter created successfully",
                data: encounter
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getEncounters(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const encounters = await service.getEncounters({
                branchId: req.query.branchId,
                doctorId: req.query.doctorId,
                patientId: req.query.patientId,
                appointmentId: req.query.appointmentId,
                status: req.query.status,
                encounterType: req.query.encounterType,
                date: req.query.date,
                dateFrom: req.query.dateFrom,
                dateTo: req.query.dateTo,
                search: req.query.search,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10)
            });
            return res.json({
                success: true,
                message: "Encounters fetched successfully",
                data: encounters
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getCheckedInPatientsToday(req, res) {
        try {
            const totalPatients = await service.getCheckedInPatientsToday(req.query.employeeId, req.query.branchId);
            return res.json({
                success: true,
                message: "Patients checked in today fetched successfully",
                data: { totalPatients }
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getEncounterByNumber(req, res) {
        try {
            const encounter = await service.getEncounterByNumber(req.params.encounterNo);
            return res.json({
                success: true,
                message: "Encounter fetched successfully",
                data: encounter
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async getEncounterByAppointment(req, res) {
        try {
            const user = req.user;
            const encounter = await service.getEncounterByAppointmentId(req.params.appointmentId, user?.user_id, user?.role);
            return res.json({
                success: true,
                message: "Encounter fetched successfully",
                data: encounter
            });
        }
        catch (error) {
            const status = error?.status === 404 || error?.status === 403 ? error.status : 500;
            return res.status(status).json({
                success: false,
                message: error.message
            });
        }
    }
    async getLatestPatientEncounters(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const user = req.user;
            const parsedLimit = parseInt(String(req.query.limit ?? ""), 10);
            const encounters = await service.getLatestEncountersForPatient(String(req.query.patientId), user?.user_id, user?.role, Number.isFinite(parsedLimit) ? parsedLimit : undefined);
            return res.json({
                success: true,
                message: "Latest encounters fetched successfully",
                data: {
                    encounters
                }
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async updateEncounter(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const encounter = await service.updateEncounter(req.params.encounterNo, req.body);
            return res.json({
                success: true,
                message: "Encounter updated successfully",
                data: encounter
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async closeEncounter(req, res) {
        try {
            const closedBy = req.user?.role || "SYSTEM";
            const encounter = await service.closeEncounter(req.params.encounterNo, closedBy);
            return res.json({
                success: true,
                message: "Encounter closed successfully",
                data: encounter
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
exports.EncounterController = EncounterController;
