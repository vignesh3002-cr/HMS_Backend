"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTnmStageValidation = exports.createTnmStageValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createTnmStageValidation = [
    (0, express_validator_1.body)("cancer_type_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("t_category")
        .optional()
        .isLength({ max: 10 })
        .withMessage("T category must not exceed 10 characters"),
    (0, express_validator_1.body)("n_category")
        .optional()
        .isLength({ max: 10 })
        .withMessage("N category must not exceed 10 characters"),
    (0, express_validator_1.body)("m_category")
        .optional()
        .isLength({ max: 10 })
        .withMessage("M category must not exceed 10 characters"),
    (0, express_validator_1.body)("tnm_combined_code")
        .notEmpty()
        .withMessage("Combined TNM code is required (e.g. T2N1M0)")
        .isLength({ max: 30 }),
    (0, express_validator_1.body)("staging_edition")
        .optional()
        .isString(),
    (0, express_validator_1.body)("overall_stage_group")
        .optional()
        .isString()
];
exports.updateTnmStageValidation = [
    (0, express_validator_1.body)("tnm_combined_code")
        .optional()
        .isLength({ max: 30 }),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
