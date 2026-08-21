"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePatientValidation = exports.createPatientValidation = void 0;
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
