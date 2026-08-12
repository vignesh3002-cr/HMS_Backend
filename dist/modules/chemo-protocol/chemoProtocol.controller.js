"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChemoProtocolController = void 0;
const express_validator_1 = require("express-validator");
const chemoProtocol_service_1 = require("./chemoProtocol.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new chemoProtocol_service_1.ChemoProtocolService();
class ChemoProtocolController {
    async createProtocol(req, res) {
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
            const record = await service.createProtocol(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Chemotherapy protocol created successfully",
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
    async getProtocols(req, res) {
        try {
            const result = await service.getProtocols({
                search: req.query.search,
                cancerTypeId: req.query.cancerTypeId,
                cancerStageId: req.query.cancerStageId,
                treatmentIntentId: req.query.treatmentIntentId,
                isActive: req.query.isActive,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocols fetched successfully",
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
    async getProtocolById(req, res) {
        try {
            const record = await service.getProtocolById(req.params.protocolId);
            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocol fetched successfully",
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
    async updateProtocol(req, res) {
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
            const record = await service.updateProtocol(req.params.protocolId, req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocol updated successfully",
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
    async deleteProtocol(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.deleteProtocol(req.params.protocolId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocol deleted successfully",
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
    async restoreProtocol(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.restoreProtocol(req.params.protocolId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocol restored successfully",
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
    // ---- Protocol <-> Drug bridge ----
    async addDrugToProtocol(req, res) {
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
            const record = await service.addDrugToProtocol(req.params.protocolId, req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_DRUG",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Drug added to protocol successfully",
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
    async updateProtocolDrug(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const record = await service.updateProtocolDrug(req.params.protocolDrugId, req.body);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_DRUG",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Protocol drug entry updated successfully",
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
    async removeDrugFromProtocol(req, res) {
        try {
            const record = await service.removeDrugFromProtocol(req.params.protocolDrugId);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_DRUG",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Drug removed from protocol successfully",
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
exports.ChemoProtocolController = ChemoProtocolController;
