"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHospitalsValidation = exports.getHospitalValidation = exports.updateHospitalValidation = exports.createHospitalValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createHospitalValidation = [
    (0, express_validator_1.body)("hospital_name")
        .notEmpty()
        .withMessage("Hospital name is required")
        .isLength({ max: 100 })
        .withMessage("Hospital name cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_address")
        .optional()
        .isLength({ max: 300 })
        .withMessage("Address cannot exceed 300 characters"),
    (0, express_validator_1.body)("contact_number")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Contact number cannot exceed 100 characters"),
    (0, express_validator_1.body)("email_id")
        .optional()
        .isEmail()
        .withMessage("Invalid email format"),
    (0, express_validator_1.body)("website_address")
        .optional()
        .isURL()
        .withMessage("Invalid website URL"),
    (0, express_validator_1.body)("hospital_type")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Hospital type cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_license_no")
        .optional()
        .isLength({ max: 100 })
        .withMessage("License number cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_country")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Country cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_state")
        .optional()
        .isLength({ max: 100 })
        .withMessage("State cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_district")
        .optional()
        .isLength({ max: 100 })
        .withMessage("District cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_area")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Area cannot exceed 100 characters"),
    (0, express_validator_1.body)("pincode")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Pincode cannot exceed 100 characters"),
    (0, express_validator_1.body)("timezone")
        .optional()
        .isLength({ max: 64 })
        .withMessage("Invalid timezone"),
];
exports.updateHospitalValidation = [
    (0, express_validator_1.param)("hospitalId")
        .notEmpty()
        .withMessage("Hospital ID is required"),
    (0, express_validator_1.body)("hospital_name")
        .optional()
        .notEmpty()
        .withMessage("Hospital name cannot be empty")
        .isLength({ max: 100 })
        .withMessage("Hospital name cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_address")
        .optional()
        .isLength({ max: 300 })
        .withMessage("Address cannot exceed 300 characters"),
    (0, express_validator_1.body)("contact_number")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Contact number cannot exceed 100 characters"),
    (0, express_validator_1.body)("email_id")
        .optional()
        .isEmail()
        .withMessage("Invalid email format"),
    (0, express_validator_1.body)("website_address")
        .optional()
        .isURL()
        .withMessage("Invalid website URL"),
    (0, express_validator_1.body)("hospital_type")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Hospital type cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_license_no")
        .optional()
        .isLength({ max: 100 })
        .withMessage("License number cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_country")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Country cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_state")
        .optional()
        .isLength({ max: 100 })
        .withMessage("State cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_district")
        .optional()
        .isLength({ max: 100 })
        .withMessage("District cannot exceed 100 characters"),
    (0, express_validator_1.body)("hospital_area")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Area cannot exceed 100 characters"),
    (0, express_validator_1.body)("pincode")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Pincode cannot exceed 100 characters"),
    (0, express_validator_1.body)("timezone")
        .optional()
        .isLength({ max: 64 })
        .withMessage("Invalid timezone"),
];
exports.getHospitalValidation = [
    (0, express_validator_1.param)("hospitalId")
        .notEmpty()
        .withMessage("Hospital ID is required"),
];
exports.listHospitalsValidation = [
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
];
