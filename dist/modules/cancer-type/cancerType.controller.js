"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancerTypeController = void 0;
const express_validator_1 = require("express-validator");
const cancerType_service_1 = require("./cancerType.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new cancerType_service_1.CancerTypeService();
class CancerTypeController {
    async createCancerType(req, res) {
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
            const cancerType = await service.createCancerType(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CANCER_TYPE_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Cancer type created successfully",
                data: cancerType
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getCancerTypes(req, res) {
        try {
            const result = await service.getCancerTypes({
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
                message: "Cancer types fetched successfully",
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
    async getCancerTypeById(req, res) {
        try {
            const cancerType = await service.getCancerTypeById(req.params.cancerTypeId);
            return res.status(200).json({
                success: true,
                message: "Cancer type fetched successfully",
                data: cancerType
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async updateCancerType(req, res) {
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
            const cancerType = await service.updateCancerType(req.params.cancerTypeId, req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CANCER_TYPE_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Cancer type updated successfully",
                data: cancerType
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async deleteCancerType(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const cancerType = await service.deleteCancerType(req.params.cancerTypeId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CANCER_TYPE_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Cancer type deleted successfully",
                data: cancerType
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async restoreCancerType(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const cancerType = await service.restoreCancerType(req.params.cancerTypeId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "CANCER_TYPE_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Cancer type restored successfully",
                data: cancerType
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
exports.CancerTypeController = CancerTypeController;
