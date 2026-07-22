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
