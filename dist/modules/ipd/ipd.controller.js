"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpdController = void 0;
const express_validator_1 = require("express-validator");
const ipd_service_1 = require("./ipd.service");
const service = new ipd_service_1.IpdService();
class IpdController {
    async createAdmission(req, res) {
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
            const admission = await service.createAdmission(req.body, createdBy);
            return res.status(201).json({
                success: true,
                message: "Admission created successfully",
                data: admission
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async listAdmissions(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const admissions = await service.listAdmissions({
                branchId: req.query.branchId,
                status: req.query.status,
                wardId: req.query.wardId,
                patientId: req.query.patientId,
                date: req.query.date,
                search: req.query.search,
                page: req.query.page,
                limit: req.query.limit,
                sortField: req.query.sortField,
                sortDirection: req.query.sortDirection
            });
            return res.json({
                success: true,
                message: "Admissions fetched successfully",
                data: admissions
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getAdmissionByIpNumber(req, res) {
        try {
            const admission = await service.getAdmissionByIpNumber((req.params.ipNumber || req.params.id));
            return res.json({
                success: true,
                message: "Admission fetched successfully",
                data: admission
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    async updateAdmission(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const updatedBy = req.user?.role || "SYSTEM";
            const admission = await service.updateAdmission(req.params.id, req.body, updatedBy);
            return res.json({
                success: true,
                message: "Admission updated successfully",
                data: admission
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async dischargeAdmission(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const closedBy = req.user?.role || "SYSTEM";
            const admission = await service.dischargeAdmission(req.params.id, closedBy, req.body);
            return res.json({
                success: true,
                message: "Admission discharged successfully",
                data: admission
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async transferAdmission(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const transferredBy = req.user?.role || "SYSTEM";
            const result = await service.transferAdmission(req.params.id, req.body.targetWardId, req.body.targetBedId, req.body.reason, transferredBy);
            return res.json({
                success: true,
                message: "Admission transferred successfully",
                data: result
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getAdmittedPatientsToday(req, res) {
        try {
            const totalPatients = await service.getAdmittedPatientsToday(req.query.branchId);
            return res.json({
                success: true,
                message: "Admitted patients today fetched successfully",
                data: { totalPatients }
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async getIpdOverview(req, res) {
        try {
            const overview = await service.getIpdOverview(req.query.branchId);
            return res.json({
                success: true,
                message: "IPD overview fetched successfully",
                data: overview
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async listWards(req, res) {
        try {
            const wards = await service.listWards(req.query.branchId);
            return res.json({
                success: true,
                message: "Wards fetched successfully",
                data: wards
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async listBeds(req, res) {
        try {
            const beds = await service.listBeds(req.query.wardId, req.query.branchId);
            return res.json({
                success: true,
                message: "Beds fetched successfully",
                data: beds
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async createWard(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const ward = await service.createWard(req.body, req.user);
            return res.status(201).json({
                success: true,
                message: "Ward created successfully",
                data: ward
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async createBed(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }
            const bed = await service.createBed(req.body, req.user);
            return res.status(201).json({
                success: true,
                message: "Bed created successfully",
                data: bed
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
exports.IpdController = IpdController;
