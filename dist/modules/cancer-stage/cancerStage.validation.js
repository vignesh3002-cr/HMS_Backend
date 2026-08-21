"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCancerStageValidation = exports.createCancerStageValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createCancerStageValidation = [
    (0, express_validator_1.body)("stage_code")
        .notEmpty()
        .withMessage("Stage code is required")
        .isLength({ max: 20 })
        .withMessage("Stage code must not exceed 20 characters"),
    (0, express_validator_1.body)("stage_name")
        .notEmpty()
        .withMessage("Stage name is required")
        .isLength({ max: 100 })
        .withMessage("Stage name must not exceed 100 characters"),
    (0, express_validator_1.body)("stage_group")
        .optional()
        .isString(),
    (0, express_validator_1.body)("description")
        .optional()
        .isString()
];
exports.updateCancerStageValidation = [
    (0, express_validator_1.body)("stage_name")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Stage name must not exceed 100 characters"),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
