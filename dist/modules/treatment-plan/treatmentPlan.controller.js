"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatmentPlanController = void 0;
const express_validator_1 = require("express-validator");
const treatmentPlan_service_1 = require("./treatmentPlan.service");
const auditLog_1 = require("../../utils/auditLog");
const service = new treatmentPlan_service_1.TreatmentPlanService();
class TreatmentPlanController {
    async createTreatmentPlan(req, res) {
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
            const record = await service.createTreatmentPlan(req.body, createdBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                branchId: req.body.branch_id,
                moduleName: "TREATMENT_PLAN",
                actionType: "CREATE"
            });
            return res.status(201).json({
                success: true,
                message: "Treatment plan created successfully",
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
    async getTreatmentPlans(req, res) {
        try {
            const result = await service.getTreatmentPlans({
                patientId: req.query.patientId,
                diagnosisId: req.query.diagnosisId,
                protocolId: req.query.protocolId,
                planStatus: req.query.planStatus,
                branchId: req.query.branchId,
                doctorId: req.query.doctorId,
                isActive: req.query.isActive,
                search: req.query.search,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10),
                sortBy: req.query.sortBy || "created_at",
                sortOrder: req.query.sortOrder || "desc"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment plans fetched successfully",
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
    async getTreatmentPlanById(req, res) {
        try {
            const record = await service.getTreatmentPlanById(req.params.treatmentPlanId);
            return res.status(200).json({
                success: true,
                message: "Treatment plan fetched successfully",
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
    async updateTreatmentPlan(req, res) {
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
            const record = await service.updateTreatmentPlan(req.params.treatmentPlanId, req.body, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TREATMENT_PLAN",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment plan updated successfully",
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
    async approveTreatmentPlan(req, res) {
        try {
            const approvedBy = req.user?.username || "SYSTEM";
            const record = await service.approveTreatmentPlan(req.params.treatmentPlanId, approvedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TREATMENT_PLAN",
                actionType: "UPDATE"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment plan approved successfully",
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
    async deleteTreatmentPlan(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.deleteTreatmentPlan(req.params.treatmentPlanId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TREATMENT_PLAN",
                actionType: "DELETE"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment plan cancelled successfully",
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
    async restoreTreatmentPlan(req, res) {
        try {
            const updatedBy = req.user?.username || "SYSTEM";
            const record = await service.restoreTreatmentPlan(req.params.treatmentPlanId, updatedBy);
            await (0, auditLog_1.recordAuditLog)({
                username: req.user?.username,
                moduleName: "TREATMENT_PLAN",
                actionType: "RESTORE"
            });
            return res.status(200).json({
                success: true,
                message: "Treatment plan restored successfully",
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
exports.TreatmentPlanController = TreatmentPlanController;
