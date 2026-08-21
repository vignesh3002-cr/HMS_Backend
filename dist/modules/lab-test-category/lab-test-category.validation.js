"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLabTestCategoryValidation = exports.createLabTestCategoryValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createLabTestCategoryValidation = [
    (0, express_validator_1.body)("category_name")
        .notEmpty()
        .withMessage("Category Name is required"),
    (0, express_validator_1.body)("category_code")
        .notEmpty()
        .withMessage("Category Code is required"),
    (0, express_validator_1.body)("description")
        .optional()
        .isString()
        .withMessage("Description must be a string"),
    (0, express_validator_1.body)("display_order")
        .optional()
        .isInt()
        .withMessage("Display Order must be a number"),
    (0, express_validator_1.body)("category_status")
        .optional()
        .isIn([0, 1])
        .withMessage("Category Status must be 0 or 1"),
];
exports.updateLabTestCategoryValidation = [
    (0, express_validator_1.body)("category_name")
        .optional()
        .notEmpty()
        .withMessage("Category Name cannot be empty"),
    (0, express_validator_1.body)("category_code")
        .optional()
        .notEmpty()
        .withMessage("Category Code cannot be empty"),
    (0, express_validator_1.body)("description")
        .optional()
        .isString()
        .withMessage("Description must be a string"),
    (0, express_validator_1.body)("display_order")
        .optional()
        .isInt()
        .withMessage("Display Order must be a number"),
    (0, express_validator_1.body)("category_status")
        .optional()
        .isIn([0, 1])
        .withMessage("Category Status must be 0 or 1"),
];
