"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientController = void 0;
const express_validator_1 = require("express-validator");
const patient_service_1 = require("./patient.service");
const service = new patient_service_1.PatientService();
class PatientController {
    async createPatient(req, res) {
        try {
            const createdBy = req.user?.role || "SYSTEM";
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const patient = await service.createPatient(req.body, createdBy);
            return res.status(201).json({
                success: true,
                message: "Patient created successfully",
                data: patient
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getPatients(req, res) {
        try {
            const patients = await service.getPatients({
                branchId: req.query.branchId,
                patientType: req.query.patientType,
                status: req.query.status,
                search: req.query.search,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10)
            });
            return res.json({
                success: true,
                message: "Patients fetched successfully",
                data: patients
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getPatientById(req, res) {
        try {
            const patient = await service.getPatientById(req.params.patientId);
            return res.json({
                success: true,
                message: "Patient fetched successfully",
                data: patient
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async updatePatient(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const patient = await service.updatePatient(req.params.patientId, req.body);
            return res.json({
                success: true,
                message: "Patient updated successfully",
                data: patient
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
exports.PatientController = PatientController;
