"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatmentIntentController = void 0;
const express_validator_1 = require("express-validator");
const treatmentIntent_service_1 = require("./treatmentIntent.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new treatmentIntent_service_1.TreatmentIntentService();
class TreatmentIntentController {
    async createTreatmentIntent(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const createdBy = req.user?.username || "SYSTEM";
            const record = await service.createTreatmentIntent(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TREATMENT_INTENT_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Treatment intent created successfully",
                data: record
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getTreatmentIntents(req, res) {
        try {
            const result = await service.getTreatmentIntents({
                search: req.query.search,
                isActive: req.query.isActive,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment intents fetched successfully",
                data: result.records,
                pagination: result.pagination
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getTreatmentIntentById(req, res) {
        try {
            const record = await service.getTreatmentIntentById(req.params.treatmentIntentId);
            return res.status(200).json({
                success: true,
                message: "Treatment intent fetched successfully",
                data: record
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async updateTreatmentIntent(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.updateTreatmentIntent(req.params.treatmentIntentId, req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TREATMENT_INTENT_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment intent updated successfully",
                data: record
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async deleteTreatmentIntent(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.deleteTreatmentIntent(req.params.treatmentIntentId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TREATMENT_INTENT_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment intent deleted successfully",
                data: record
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async restoreTreatmentIntent(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.restoreTreatmentIntent(req.params.treatmentIntentId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TREATMENT_INTENT_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment intent restored successfully",
                data: record
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
exports.TreatmentIntentController = TreatmentIntentController;
