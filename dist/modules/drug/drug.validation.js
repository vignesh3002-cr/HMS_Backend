"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDrugValidation = exports.createDrugValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createDrugValidation = [
    (0, express_validator_1.body)("drug_code")
        .notEmpty()
        .withMessage("Drug code is required")
        .isLength({ max: 30 })
        .withMessage("Drug code must not exceed 30 characters"),
    (0, express_validator_1.body)("drug_name")
        .notEmpty()
        .withMessage("Drug name is required")
        .isLength({ max: 200 })
        .withMessage("Drug name must not exceed 200 characters"),
    (0, express_validator_1.body)("generic_name")
        .optional()
        .isString(),
    (0, express_validator_1.body)("brand_name")
        .optional()
        .isString(),
    (0, express_validator_1.body)("drug_class")
        .optional()
        .isString(),
    (0, express_validator_1.body)("vesicant_status")
        .optional()
        .isIn(["Vesicant", "Irritant", "Non-vesicant"])
        .withMessage("vesicant_status must be one of Vesicant, Irritant, Non-vesicant"),
    (0, express_validator_1.body)("administration_route")
        .optional()
        .isString(),
    (0, express_validator_1.body)("standard_unit")
        .optional()
        .isString(),
    (0, express_validator_1.body)("max_dose_per_cycle")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("max_dose_per_cycle must be a positive number"),
    (0, express_validator_1.body)("is_high_alert")
        .optional()
        .isBoolean(),
    (0, express_validator_1.body)("linked_medicine_id")
        .optional()
        .isString()
];
exports.updateDrugValidation = [
    (0, express_validator_1.body)("drug_name")
        .optional()
        .isLength({ max: 200 }),
    (0, express_validator_1.body)("vesicant_status")
        .optional()
        .isIn(["Vesicant", "Irritant", "Non-vesicant"])
        .withMessage("vesicant_status must be one of Vesicant, Irritant, Non-vesicant"),
    (0, express_validator_1.body)("max_dose_per_cycle")
        .optional()
        .isFloat({ min: 0 }),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
