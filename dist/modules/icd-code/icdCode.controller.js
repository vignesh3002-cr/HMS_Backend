"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IcdCodeController = void 0;
const express_validator_1 = require("express-validator");
const icdCode_service_1 = require("./icdCode.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new icdCode_service_1.IcdCodeService();
class IcdCodeController {
    async createIcdCode(req, res) {
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
            const record = await service.createIcdCode(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "ICD_CODE_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "ICD code created successfully",
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
    async getIcdCodes(req, res) {
        try {
            const result = await service.getIcdCodes({
                search: req.query.search,
                icdVersion: req.query.icdVersion,
                category: req.query.category,
                isActive: req.query.isActive,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "ICD codes fetched successfully",
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
    async getIcdCodeById(req, res) {
        try {
            const record = await service.getIcdCodeById(req.params["icdCodeId"]);
            return res.status(200).json({
                success: true,
                message: "ICD code fetched successfully",
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
    async updateIcdCode(req, res) {
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
            const record = await service.updateIcdCode(req.params["icdCodeId"], req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "ICD_CODE_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "ICD code updated successfully",
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
    async deleteIcdCode(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.deleteIcdCode(req.params["icdCodeId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "ICD_CODE_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "ICD code deleted successfully",
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
    async restoreIcdCode(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.restoreIcdCode(req.params["icdCodeId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "ICD_CODE_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "ICD code restored successfully",
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
exports.IcdCodeController = IcdCodeController;
