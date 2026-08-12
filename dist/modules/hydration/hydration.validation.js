"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateHydrationValidation = exports.createHydrationValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createHydrationValidation = [
    (0, express_validator_1.body)("hydration_code")
        .notEmpty()
        .withMessage("Hydration code is required")
        .isLength({ max: 30 }),
    (0, express_validator_1.body)("fluid_name")
        .notEmpty()
        .withMessage("Fluid name is required (e.g. Normal Saline 0.9%)")
        .isLength({ max: 200 }),
    (0, express_validator_1.body)("fluid_type")
        .optional()
        .isString(),
    (0, express_validator_1.body)("standard_volume_ml")
        .optional()
        .isInt({ min: 0 })
        .withMessage("standard_volume_ml must be a positive integer"),
    (0, express_validator_1.body)("infusion_rate")
        .optional()
        .isString(),
    (0, express_validator_1.body)("timing")
        .optional()
        .isIn(["Pre-hydration", "Post-hydration", "Concurrent"])
        .withMessage("timing must be one of Pre-hydration, Post-hydration, Concurrent"),
    (0, express_validator_1.body)("indication")
        .optional()
        .isString(),
    (0, express_validator_1.body)("linked_medicine_id")
        .optional()
        .isString()
];
exports.updateHydrationValidation = [
    (0, express_validator_1.body)("fluid_name")
        .optional()
        .isLength({ max: 200 }),
    (0, express_validator_1.body)("standard_volume_ml")
        .optional()
        .isInt({ min: 0 }),
    (0, express_validator_1.body)("timing")
        .optional()
        .isIn(["Pre-hydration", "Post-hydration", "Concurrent"])
        .withMessage("timing must be one of Pre-hydration, Post-hydration, Concurrent"),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
