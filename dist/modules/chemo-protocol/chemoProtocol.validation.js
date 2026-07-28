"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProtocolDrugValidation = exports.addProtocolDrugValidation = exports.updateProtocolValidation = exports.createProtocolValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createProtocolValidation = [
    (0, express_validator_1.body)("protocol_code")
        .notEmpty()
        .withMessage("Protocol code is required (e.g. FOLFOX)")
        .isLength({ max: 30 }),
    (0, express_validator_1.body)("protocol_name")
        .notEmpty()
        .withMessage("Protocol name is required")
        .isLength({ max: 200 }),
    (0, express_validator_1.body)("cancer_type_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("cancer_stage_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("treatment_intent_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("cycle_length_days")
        .optional()
        .isInt({ min: 1 })
        .withMessage("cycle_length_days must be a positive integer"),
    (0, express_validator_1.body)("total_recommended_cycles")
        .optional()
        .isInt({ min: 1 })
        .withMessage("total_recommended_cycles must be a positive integer"),
    (0, express_validator_1.body)("protocol_description")
        .optional()
        .isString(),
    (0, express_validator_1.body)("reference_guideline")
        .optional()
        .isString()
];
exports.updateProtocolValidation = [
    (0, express_validator_1.body)("protocol_name")
        .optional()
        .isLength({ max: 200 }),
    (0, express_validator_1.body)("cycle_length_days")
        .optional()
        .isInt({ min: 1 }),
    (0, express_validator_1.body)("total_recommended_cycles")
        .optional()
        .isInt({ min: 1 }),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
exports.addProtocolDrugValidation = [
    (0, express_validator_1.body)("drug_id")
        .notEmpty()
        .withMessage("drug_id is required"),
    (0, express_validator_1.body)("administration_day")
        .optional()
        .isString(),
    (0, express_validator_1.body)("dose")
        .optional()
        .isString(),
    (0, express_validator_1.body)("sequence_order")
        .optional()
        .isInt({ min: 1 })
        .withMessage("sequence_order must be a positive integer"),
    (0, express_validator_1.body)("infusion_duration")
        .optional()
        .isString()
];
exports.updateProtocolDrugValidation = [
    (0, express_validator_1.body)("administration_day")
        .optional()
        .isString(),
    (0, express_validator_1.body)("dose")
        .optional()
        .isString(),
    (0, express_validator_1.body)("sequence_order")
        .optional()
        .isInt({ min: 1 }),
    (0, express_validator_1.body)("infusion_duration")
        .optional()
        .isString(),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
];
