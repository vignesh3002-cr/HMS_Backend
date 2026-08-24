"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPatientHistoryValidation = exports.updatePatientValidation = exports.createPatientValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createPatientValidation = [
    (0, express_validator_1.body)("username")
        .notEmpty()
        .withMessage("Username is required"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 6 })
        .withMessage("Password should contain minimum 6 characters"),
    (0, express_validator_1.body)("first_name")
        .notEmpty()
        .withMessage("First name is required"),
    (0, express_validator_1.body)("mobile")
        .isMobilePhone("any")
        .withMessage("Valid mobile number is required"),
    (0, express_validator_1.body)("email")
        .optional()
        .isEmail()
        .withMessage("Valid email is required"),
    (0, express_validator_1.body)("branch_id")
        .notEmpty()
        .withMessage("Branch is required"),
    (0, express_validator_1.body)("created_by")
        .notEmpty()
        .withMessage("Created by is required")
];
exports.updatePatientValidation = [
    (0, express_validator_1.body)("mobile")
        .optional()
        .isMobilePhone("any")
        .withMessage("Valid mobile number is required"),
    (0, express_validator_1.body)("email")
        .optional()
        .isEmail()
        .withMessage("Valid email is required")
];
exports.createPatientHistoryValidation = [
    (0, express_validator_1.body)("patientId")
        .notEmpty()
        .withMessage("Patient ID is required"),
    (0, express_validator_1.body)("appointmentId")
        .optional()
        .isString()
        .withMessage("Appointment ID must be a string"),
    (0, express_validator_1.body)("systolicBp")
        .optional()
        .isInt({ min: 0, max: 300 })
        .withMessage("Systolic BP must be between 0 and 300"),
    (0, express_validator_1.body)("diastolicBp")
        .optional()
        .isInt({ min: 0, max: 200 })
        .withMessage("Diastolic BP must be between 0 and 200"),
    (0, express_validator_1.body)("pulse")
        .optional()
        .isInt({ min: 0, max: 300 })
        .withMessage("Pulse must be between 0 and 300"),
    (0, express_validator_1.body)("respiratoryRate")
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage("Respiratory rate must be between 0 and 100"),
    (0, express_validator_1.body)("temperature")
        .optional()
        .isFloat({ min: 20, max: 45 })
        .withMessage("Temperature must be between 20 and 45"),
    (0, express_validator_1.body)("oxygenSaturation")
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage("Oxygen saturation must be between 0 and 100"),
    (0, express_validator_1.body)("bloodSugar")
        .optional()
        .isString()
        .withMessage("Blood sugar must be a string"),
    (0, express_validator_1.body)("weight")
        .optional()
        .isFloat({ min: 0, max: 500 })
        .withMessage("Weight must be between 0 and 500"),
    (0, express_validator_1.body)("height")
        .optional()
        .isFloat({ min: 0, max: 300 })
        .withMessage("Height must be between 0 and 300"),
    (0, express_validator_1.body)("painScore")
        .optional()
        .isInt({ min: 0, max: 10 })
        .withMessage("Pain score must be between 0 and 10"),
    (0, express_validator_1.body)("severity")
        .optional()
        .isInt({ min: 0, max: 10 })
        .withMessage("Severity must be between 0 and 10"),
    (0, express_validator_1.body)("clinicalNotes")
        .optional()
        .isString()
        .withMessage("Clinical notes must be a string"),
];
