"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCancerTypeValidation = exports.createCancerTypeValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createCancerTypeValidation = [
    (0, express_validator_1.body)("cancer_type_name")
        .notEmpty()
        .withMessage("Cancer type name is required")
        .isLength({ max: 200 })
        .withMessage("Cancer type name must not exceed 200 characters"),
    (0, express_validator_1.body)("cancer_category")
        .optional()
        .isString(),
    (0, express_validator_1.body)("icd_o3_code")
        .optional()
        .isString(),
    (0, express_validator_1.body)("description")
        .optional()
        .isString()
];
exports.updateCancerTypeValidation = [
    (0, express_validator_1.param)("cancerTypeId")
        .notEmpty()
        .withMessage("Cancer type id is required"),
    (0, express_validator_1.body)("cancer_type_name")
        .optional()
        .isLength({ max: 200 })
        .withMessage("Cancer type name must not exceed 200 characters"),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
