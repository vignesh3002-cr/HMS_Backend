"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosisController = void 0;
const express_validator_1 = require("express-validator");
const diagnosis_service_1 = require("./diagnosis.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new diagnosis_service_1.DiagnosisService();
class DiagnosisController {
    async createDiagnosis(req, res) {
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
            const record = await service.createDiagnosis(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                branchId: req.body.branch_id,
                moduleName: "DIAGNOSIS",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Diagnosis created successfully",
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
    async getDiagnoses(req, res) {
        try {
            const result = await service.getDiagnoses({
                patientId: req.query.patientId,
                branchId: req.query.branchId,
                departmentId: req.query.departmentId,
                doctorId: req.query.doctorId,
                cancerTypeId: req.query.cancerTypeId,
                diagnosisStatus: req.query.diagnosisStatus,
                isActive: req.query.isActive,
                search: req.query.search,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "Diagnoses fetched successfully",
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
    async getDiagnosisById(req, res) {
        try {
            const record = await service.getDiagnosisById(req.params.diagnosisId);
            return res.status(200).json({
                success: true,
                message: "Diagnosis fetched successfully",
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
    async updateDiagnosis(req, res) {
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
            const record = await service.updateDiagnosis(req.params.diagnosisId, req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "DIAGNOSIS",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Diagnosis updated successfully",
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
    async deleteDiagnosis(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.deleteDiagnosis(req.params.diagnosisId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "DIAGNOSIS",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Diagnosis deleted successfully",
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
    async restoreDiagnosis(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.restoreDiagnosis(req.params.diagnosisId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "DIAGNOSIS",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Diagnosis restored successfully",
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
exports.DiagnosisController = DiagnosisController;
