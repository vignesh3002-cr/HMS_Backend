"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateHistomorphologyValidation = exports.createHistomorphologyValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createHistomorphologyValidation = [
    (0, express_validator_1.body)("morphology_code")
        .notEmpty()
        .withMessage("Morphology code is required (e.g. ICD-O-3 code 8140/3)")
        .isLength({ max: 20 })
        .withMessage("Morphology code must not exceed 20 characters"),
    (0, express_validator_1.body)("morphology_name")
        .notEmpty()
        .withMessage("Morphology name is required")
        .isLength({ max: 300 })
        .withMessage("Morphology name must not exceed 300 characters"),
    (0, express_validator_1.body)("behavior")
        .optional()
        .isIn(["Benign", "Malignant", "In-situ", "Uncertain"])
        .withMessage("Behavior must be one of Benign, Malignant, In-situ, Uncertain"),
    (0, express_validator_1.body)("description")
        .optional()
        .isString()
];
exports.updateHistomorphologyValidation = [
    (0, express_validator_1.body)("morphology_name")
        .optional()
        .isLength({ max: 300 }),
    (0, express_validator_1.body)("behavior")
        .optional()
        .isIn(["Benign", "Malignant", "In-situ", "Uncertain"])
        .withMessage("Behavior must be one of Benign, Malignant, In-situ, Uncertain"),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
