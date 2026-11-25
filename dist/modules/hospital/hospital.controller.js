"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalController = void 0;
const express_validator_1 = require("express-validator");
const hospital_service_1 = require("./hospital.service");
const service = new hospital_service_1.HospitalService();
const httpError = (message, status) => {
    const err = new Error(message);
    err.status = status;
    return err;
};
class HospitalController {
    async createHospital(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const hospital = await service.create(req.body);
            return res.status(201).json({
                success: true,
                message: "Hospital created successfully",
                data: hospital,
            });
        }
        catch (error) {
            return res.status(error.status || 400).json({
                success: false,
                message: error.message || "Failed to create hospital",
            });
        }
    }
    async getHospital(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                });
            }
            const hospital = await service.getById(String(req.params.hospitalId));
            if (!hospital) {
                return res.status(404).json({
                    success: false,
                    message: "Hospital not found",
                });
            }
            return res.json({
                success: true,
                message: "Hospital fetched successfully",
                data: hospital,
            });
        }
        catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                message: error.message || "Failed to fetch hospital",
            });
        }
    }
    async getAllHospitals(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const result = await service.getAll(page, limit);
            return res.json({
                success: true,
                message: "Hospitals fetched successfully",
                data: result.hospitals,
                pagination: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    totalPages: result.totalPages,
                },
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to fetch hospitals",
            });
        }
    }
    async updateHospital(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }
            const hospital = await service.update(String(req.params.hospitalId), req.body);
            return res.json({
                success: true,
                message: "Hospital updated successfully",
                data: hospital,
            });
        }
        catch (error) {
            return res.status(error.status || 400).json({
                success: false,
                message: error.message || "Failed to update hospital",
            });
        }
    }
}
exports.HospitalController = HospitalController;
