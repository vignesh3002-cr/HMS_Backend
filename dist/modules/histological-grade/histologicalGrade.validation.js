"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateHistologicalGradeValidation = exports.createHistologicalGradeValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createHistologicalGradeValidation = [
    (0, express_validator_1.body)("grade_code")
        .notEmpty()
        .withMessage("Grade code is required (e.g. G1, G2, G3, G4, GX)")
        .isLength({ max: 10 })
        .withMessage("Grade code must not exceed 10 characters"),
    (0, express_validator_1.body)("grade_name")
        .notEmpty()
        .withMessage("Grade name is required")
        .isLength({ max: 100 })
        .withMessage("Grade name must not exceed 100 characters"),
    (0, express_validator_1.body)("description")
        .optional()
        .isString()
];
exports.updateHistologicalGradeValidation = [
    (0, express_validator_1.body)("grade_name")
        .optional()
        .isLength({ max: 100 }),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
