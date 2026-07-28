"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancerStageController = void 0;
const express_validator_1 = require("express-validator");
const cancerStage_service_1 = require("./cancerStage.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new cancerStage_service_1.CancerStageService();
class CancerStageController {
    async createCancerStage(req, res) {
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
            const stage = await service.createCancerStage(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CANCER_STAGE_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Cancer stage created successfully",
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
    async getCancerStages(req, res) {
        try {
            const result = await service.getCancerStages({
                search: req.query.search,
                stageGroup: req.query.stageGroup,
                isActive: req.query.isActive,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "Cancer stages fetched successfully",
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
    async getCancerStageById(req, res) {
        try {
            const stage = await service.getCancerStageById(req.params["cancerStageId"]);
            return res.status(200).json({
                success: true,
                message: "Cancer stage fetched successfully",
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
    async updateCancerStage(req, res) {
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
            const stage = await service.updateCancerStage(req.params["cancerStageId"], req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CANCER_STAGE_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Cancer stage updated successfully",
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
    async deleteCancerStage(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const stage = await service.deleteCancerStage(req.params["cancerStageId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CANCER_STAGE_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Cancer stage deleted successfully",
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
    async restoreCancerStage(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const stage = await service.restoreCancerStage(req.params["cancerStageId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CANCER_STAGE_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Cancer stage restored successfully",
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
exports.CancerStageController = CancerStageController;
