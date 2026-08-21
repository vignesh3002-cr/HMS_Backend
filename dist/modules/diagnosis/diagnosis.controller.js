"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosisController = void 0;
const express_validator_1 = require("express-validator");
const diagnosis_service_1 = require("./diagnosis.service");
const service = new diagnosis_service_1.DiagnosisService();
class DiagnosisController {
    async getDiagnosisCategories(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const query = {
                search: req.query.search,
                activeOnly: req.query.activeOnly === "true",
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 50),
            };
            const result = await service.getDiagnosisCategories(query);
            return res.json({
                success: true,
                message: "Diagnosis categories fetched successfully",
                data: result,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getDiagnosesByCategory(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const query = {
                categoryId: req.params.categoryId,
                search: req.query.search,
                activeOnly: req.query.activeOnly === "true",
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 50),
            };
            const result = await service.getDiagnosesByCategory(query);
            return res.json({
                success: true,
                message: "Diagnoses fetched successfully",
                data: result,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getDiagnosisById(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const diagnosis = await service.getDiagnosisById(req.params.diagnosisId);
            return res.json({
                success: true,
                message: "Diagnosis fetched successfully",
                data: diagnosis,
            });
        }
        catch (error) {
            if (error.message === "Diagnosis not found") {
                return res.status(404).json({
                    success: false,
                    message: error.message,
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}
exports.DiagnosisController = DiagnosisController;
