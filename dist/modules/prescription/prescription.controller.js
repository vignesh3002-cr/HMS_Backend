"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrescriptionController = void 0;
const express_validator_1 = require("express-validator");
const prescription_service_1 = require("./prescription.service");
const service = new prescription_service_1.PrescriptionService();
class PrescriptionController {
    async createPrescription(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const createdBy = req.user?.role || "SYSTEM";
            const prescription = await service.createPrescription(req.body, createdBy);
            return res.status(201).json({
                success: true,
                message: "Prescription created successfully",
                data: prescription
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getPrescriptions(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const prescriptions = await service.getPrescriptions({
                branchId: req.query.branchId,
                doctorId: req.query.doctorId,
                patientHistoryId: req.query.patientHistoryId,
                appointmentId: req.query.appointmentId,
                diagnosisId: req.query.diagnosisId,
                status: req.query.status,
                date: req.query.date,
                dateFrom: req.query.dateFrom,
                dateTo: req.query.dateTo,
                search: req.query.search,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10)
            });
            return res.json({
                success: true,
                message: "Prescriptions fetched successfully",
                data: prescriptions
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getPrescriptionById(req, res) {
        try {
            const prescription = await service.getPrescriptionById(req.params.prescriptionId);
            return res.json({
                success: true,
                message: "Prescription fetched successfully",
                data: prescription
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async updatePrescription(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const actingRole = req.user?.role || "SYSTEM";
            const prescription = await service.updatePrescription(req.params.prescriptionId, req.body, actingRole);
            return res.json({
                success: true,
                message: "Prescription updated successfully",
                data: prescription
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async deletePrescription(req, res) {
        try {
            const prescription = await service.deletePrescription(req.params.prescriptionId);
            return res.json({
                success: true,
                message: "Prescription cancelled successfully",
                data: prescription
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getPrescriptionItems(req, res) {
        try {
            const items = await service.getPrescriptionItems(req.params.prescriptionId);
            return res.json({
                success: true,
                message: "Prescription items fetched successfully",
                data: items
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async addPrescriptionItem(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const item = await service.addPrescriptionItem(req.params.prescriptionId, req.body);
            return res.status(201).json({
                success: true,
                message: "Medicine added to prescription successfully",
                data: item
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async updatePrescriptionItem(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const item = await service.updatePrescriptionItem(req.params.prescriptionId, req.params.itemId, req.body);
            return res.json({
                success: true,
                message: "Prescription item updated successfully",
                data: item
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async deletePrescriptionItem(req, res) {
        try {
            await service.deletePrescriptionItem(req.params.prescriptionId, req.params.itemId);
            return res.json({
                success: true,
                message: "Prescription item removed successfully"
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getSuggestedMedicines(req, res) {
        try {
            const medicines = await service.getSuggestedMedicines(req.params.diagnosisId);
            return res.json({
                success: true,
                message: "Suggested medicines fetched successfully",
                data: medicines
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
}
exports.PrescriptionController = PrescriptionController;
