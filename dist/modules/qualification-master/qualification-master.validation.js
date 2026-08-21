"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQualificationValidation = exports.createQualificationValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createQualificationValidation = [
    (0, express_validator_1.body)("qualification_name")
        .trim()
        .notEmpty()
        .withMessage("Qualification name is required")
        .isLength({ max: 150 })
        .withMessage("Qualification name must not exceed 150 characters"),
    (0, express_validator_1.body)("designation")
        .trim()
        .notEmpty()
        .withMessage("Designation is required")
        .isLength({ max: 50 })
        .withMessage("Designation must not exceed 50 characters"),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be true or false"),
];
exports.updateQualificationValidation = [
    (0, express_validator_1.body)("qualification_name")
        .optional()
        .trim()
        .isLength({ max: 150 })
        .withMessage("Qualification name must not exceed 150 characters"),
    (0, express_validator_1.body)("designation")
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage("Designation must not exceed 50 characters"),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be true or false"),
];
