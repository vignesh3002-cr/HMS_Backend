"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualificationMasterController = exports.QualificationMasterController = void 0;
const express_validator_1 = require("express-validator");
const qualification_master_service_1 = require("./qualification-master.service");
class QualificationMasterController {
    async create(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }
            const qualification = await qualification_master_service_1.qualificationMasterService.create(req.body);
            return res.status(201).json({
                success: true,
                message: "Qualification created successfully",
                data: qualification,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getAll(req, res) {
        try {
            const { designation } = req.query;
            let result;
            if (designation) {
                result = await qualification_master_service_1.qualificationMasterService.getByDesignation(designation);
            }
            else {
                result = await qualification_master_service_1.qualificationMasterService.getAll();
            }
            return res.status(200).json({
                success: true,
                count: result.length,
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
    async getById(req, res) {
        try {
            const qualification = await qualification_master_service_1.qualificationMasterService.getById(String(req.params.id));
            return res.status(200).json({
                success: true,
                data: qualification,
            });
        }
        catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
    }
    async update(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }
            const qualification = await qualification_master_service_1.qualificationMasterService.update(String(req.params.id), req.body);
            return res.status(200).json({
                success: true,
                message: "Qualification updated successfully",
                data: qualification,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async delete(req, res) {
        try {
            await qualification_master_service_1.qualificationMasterService.delete(String(req.params.id));
            return res.status(200).json({
                success: true,
                message: "Qualification deleted successfully",
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
    async getByDesignation(req, res) {
        try {
            const designation = String(req.params.designation);
            const qualifications = await qualification_master_service_1.qualificationMasterService.getByDesignation(designation);
            return res.status(200).json({
                success: true,
                message: "Qualifications fetched successfully",
                data: qualifications,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}
exports.QualificationMasterController = QualificationMasterController;
exports.qualificationMasterController = new QualificationMasterController();
