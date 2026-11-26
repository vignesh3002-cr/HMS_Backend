"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLabTestMasterValidation = exports.createLabTestMasterValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createLabTestMasterValidation = [
    (0, express_validator_1.body)("test_name")
        .notEmpty()
        .withMessage("Test Name is required"),
    (0, express_validator_1.body)("test_code")
        .notEmpty()
        .withMessage("Test Code is required"),
    (0, express_validator_1.body)("price")
        .optional()
        .isNumeric()
        .withMessage("Price must be numeric"),
    (0, express_validator_1.body)("tat_hours")
        .optional()
        .isInt()
        .withMessage("TAT Hours must be a number"),
    (0, express_validator_1.body)("parameters")
        .optional()
        .isArray()
        .withMessage("Parameters must be an array")
];
exports.updateLabTestMasterValidation = [
    (0, express_validator_1.body)("test_name")
        .optional()
        .notEmpty(),
    (0, express_validator_1.body)("test_code")
        .optional()
        .notEmpty(),
    (0, express_validator_1.body)("price")
        .optional()
        .isNumeric(),
    (0, express_validator_1.body)("tat_hours")
        .optional()
        .isInt(),
    (0, express_validator_1.body)("parameters")
        .optional()
        .isArray()
];
