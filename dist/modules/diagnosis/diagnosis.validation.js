"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiagnosisByIdValidation = exports.getDiagnosesByCategoryValidation = exports.getDiagnosisCategoriesValidation = void 0;
const express_validator_1 = require("express-validator");
exports.getDiagnosisCategoriesValidation = [
    (0, express_validator_1.query)("search")
        .optional()
        .isString()
        .trim()
        .withMessage("Search must be a string"),
    (0, express_validator_1.query)("activeOnly")
        .optional()
        .isBoolean()
        .withMessage("activeOnly must be a boolean"),
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
];
exports.getDiagnosesByCategoryValidation = [
    (0, express_validator_1.param)("categoryId")
        .notEmpty()
        .withMessage("Category ID is required")
        .isString()
        .withMessage("Category ID must be a string"),
    (0, express_validator_1.query)("search")
        .optional()
        .isString()
        .trim()
        .withMessage("Search must be a string"),
    (0, express_validator_1.query)("activeOnly")
        .optional()
        .isBoolean()
        .withMessage("activeOnly must be a boolean"),
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
];
exports.getDiagnosisByIdValidation = [
    (0, express_validator_1.param)("diagnosisId")
        .notEmpty()
        .withMessage("Diagnosis ID is required")
        .isString()
        .withMessage("Diagnosis ID must be a string"),
];
