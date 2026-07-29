"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePremedicationValidation = exports.createPremedicationValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createPremedicationValidation = [
    (0, express_validator_1.body)("premed_code")
        .notEmpty()
        .withMessage("Premedication code is required")
        .isLength({ max: 30 }),
    (0, express_validator_1.body)("premed_name")
        .notEmpty()
        .withMessage("Premedication name is required")
        .isLength({ max: 200 }),
    (0, express_validator_1.body)("premed_category")
        .optional()
        .isIn(["Antiemetic", "Antihistamine", "Steroid", "H2 Blocker", "Other"])
        .withMessage("premed_category must be one of Antiemetic, Antihistamine, Steroid, H2 Blocker, Other"),
    (0, express_validator_1.body)("standard_dose")
        .optional()
        .isString(),
    (0, express_validator_1.body)("route")
        .optional()
        .isString(),
    (0, express_validator_1.body)("timing_before_chemo_minutes")
        .optional()
        .isInt({ min: 0 })
        .withMessage("timing_before_chemo_minutes must be a positive integer"),
    (0, express_validator_1.body)("linked_medicine_id")
        .optional()
        .isString()
];
exports.updatePremedicationValidation = [
    (0, express_validator_1.body)("premed_name")
        .optional()
        .isLength({ max: 200 }),
    (0, express_validator_1.body)("timing_before_chemo_minutes")
        .optional()
        .isInt({ min: 0 }),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
