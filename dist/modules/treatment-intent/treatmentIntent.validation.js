"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTreatmentIntentValidation = exports.createTreatmentIntentValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createTreatmentIntentValidation = [
    (0, express_validator_1.body)("intent_code")
        .notEmpty()
        .withMessage("Intent code is required")
        .isLength({ max: 20 })
        .withMessage("Intent code must not exceed 20 characters"),
    (0, express_validator_1.body)("intent_name")
        .notEmpty()
        .withMessage("Intent name is required")
        .isIn(["Curative", "Palliative", "Neoadjuvant", "Adjuvant", "Maintenance"])
        .withMessage("Intent name must be one of Curative, Palliative, Neoadjuvant, Adjuvant, Maintenance"),
    (0, express_validator_1.body)("description")
        .optional()
        .isString()
];
exports.updateTreatmentIntentValidation = [
    (0, express_validator_1.body)("intent_name")
        .optional()
        .isIn(["Curative", "Palliative", "Neoadjuvant", "Adjuvant", "Maintenance"])
        .withMessage("Intent name must be one of Curative, Palliative, Neoadjuvant, Adjuvant, Maintenance"),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
