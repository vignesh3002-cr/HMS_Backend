"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistologicalGradeController = void 0;
const express_validator_1 = require("express-validator");
const histologicalGrade_service_1 = require("./histologicalGrade.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new histologicalGrade_service_1.HistologicalGradeService();
class HistologicalGradeController {
    async createHistologicalGrade(req, res) {
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
            const record = await service.createHistologicalGrade(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "HISTOLOGICAL_GRADE_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Histological grade created successfully",
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
    async getHistologicalGrades(req, res) {
        try {
            const result = await service.getHistologicalGrades({
                search: req.query.search,
                isActive: req.query.isActive,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "Histological grades fetched successfully",
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
    async getHistologicalGradeById(req, res) {
        try {
            const record = await service.getHistologicalGradeById(req.params["histologicalGradeId"]);
            return res.status(200).json({
                success: true,
                message: "Histological grade fetched successfully",
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
    async updateHistologicalGrade(req, res) {
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
            const record = await service.updateHistologicalGrade(req.params["histologicalGradeId"], req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "HISTOLOGICAL_GRADE_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Histological grade updated successfully",
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
    async deleteHistologicalGrade(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.deleteHistologicalGrade(req.params["histologicalGradeId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "HISTOLOGICAL_GRADE_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Histological grade deleted successfully",
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
    async restoreHistologicalGrade(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.restoreHistologicalGrade(req.params["histologicalGradeId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "HISTOLOGICAL_GRADE_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Histological grade restored successfully",
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
exports.HistologicalGradeController = HistologicalGradeController;
