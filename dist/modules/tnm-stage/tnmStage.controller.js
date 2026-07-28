"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TnmStageController = void 0;
const express_validator_1 = require("express-validator");
const tnmStage_service_1 = require("./tnmStage.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new tnmStage_service_1.TnmStageService();
class TnmStageController {
    async createTnmStage(req, res) {
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
            const stage = await service.createTnmStage(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TNM_STAGE_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "TNM stage created successfully",
                data: stage
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getTnmStages(req, res) {
        try {
            const result = await service.getTnmStages({
                search: req.query.search,
                cancerTypeId: req.query.cancerTypeId,
                overallStageGroup: req.query.overallStageGroup,
                isActive: req.query.isActive,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "TNM stages fetched successfully",
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
    async getTnmStageById(req, res) {
        try {
            const stage = await service.getTnmStageById(req.params["tnmStageId"]);
            return res.status(200).json({
                success: true,
                message: "TNM stage fetched successfully",
                data: stage
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async updateTnmStage(req, res) {
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
            const stage = await service.updateTnmStage(req.params["tnmStageId"], req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TNM_STAGE_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "TNM stage updated successfully",
                data: stage
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async deleteTnmStage(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const stage = await service.deleteTnmStage(req.params["tnmStageId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TNM_STAGE_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "TNM stage deleted successfully",
                data: stage
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async restoreTnmStage(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const stage = await service.restoreTnmStage(req.params["tnmStageId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TNM_STAGE_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "TNM stage restored successfully",
                data: stage
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
exports.TnmStageController = TnmStageController;
