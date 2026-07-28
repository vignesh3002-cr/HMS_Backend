"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremedicationController = void 0;
const express_validator_1 = require("express-validator");
const premedication_service_1 = require("./premedication.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new premedication_service_1.PremedicationService();
class PremedicationController {
    async createPremedication(req, res) {
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
            const record = await service.createPremedication(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "PREMEDICATION_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Premedication created successfully",
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
    async getPremedications(req, res) {
        try {
            const result = await service.getPremedications({
                search: req.query.search,
                category: req.query.category,
                isActive: req.query.isActive,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "Premedications fetched successfully",
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
    async getPremedicationById(req, res) {
        try {
            const record = await service.getPremedicationById(req.params["premedicationId"]);
            return res.status(200).json({
                success: true,
                message: "Premedication fetched successfully",
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
    async updatePremedication(req, res) {
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
            const record = await service.updatePremedication(req.params["premedicationId"], req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "PREMEDICATION_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Premedication updated successfully",
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
    async deletePremedication(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.deletePremedication(req.params["premedicationId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "PREMEDICATION_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Premedication deleted successfully",
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
    async restorePremedication(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.restorePremedication(req.params["premedicationId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "PREMEDICATION_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Premedication restored successfully",
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
exports.PremedicationController = PremedicationController;
