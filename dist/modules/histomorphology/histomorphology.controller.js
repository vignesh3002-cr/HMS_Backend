"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistomorphologyController = void 0;
const express_validator_1 = require("express-validator");
const histomorphology_service_1 = require("./histomorphology.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new histomorphology_service_1.HistomorphologyService();
class HistomorphologyController {
    async createHistomorphology(req, res) {
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
            const record = await service.createHistomorphology(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "HISTOMORPHOLOGY_MASTER",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Histomorphology created successfully",
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
    async getHistomorphologies(req, res) {
        try {
            const result = await service.getHistomorphologies({
                search: req.query.search,
                behavior: req.query.behavior,
                isActive: req.query.isActive,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "Histomorphologies fetched successfully",
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
    async getHistomorphologyById(req, res) {
        try {
            const record = await service.getHistomorphologyById(req.params["histomorphologyId"]);
            return res.status(200).json({
                success: true,
                message: "Histomorphology fetched successfully",
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
    async updateHistomorphology(req, res) {
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
            const record = await service.updateHistomorphology(req.params["histomorphologyId"], req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "HISTOMORPHOLOGY_MASTER",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Histomorphology updated successfully",
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
    async deleteHistomorphology(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.deleteHistomorphology(req.params["histomorphologyId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "HISTOMORPHOLOGY_MASTER",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Histomorphology deleted successfully",
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
    async restoreHistomorphology(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.restoreHistomorphology(req.params["histomorphologyId"], updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "HISTOMORPHOLOGY_MASTER",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Histomorphology restored successfully",
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
exports.HistomorphologyController = HistomorphologyController;
