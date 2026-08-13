"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLabOrderItemValidation = exports.createLabOrderItemValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createLabOrderItemValidation = [
    (0, express_validator_1.body)("lab_order_id")
        .notEmpty()
        .withMessage("Lab Order ID is required"),
    (0, express_validator_1.body)("lab_test_id")
        .notEmpty()
        .withMessage("Lab Test ID is required"),
    (0, express_validator_1.body)("quantity")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Quantity must be a positive integer"),
    (0, express_validator_1.body)("discount")
        .optional()
        .isNumeric()
        .withMessage("Discount must be a number"),
    (0, express_validator_1.body)("remarks")
        .optional()
        .isString()
        .withMessage("Remarks must be a string"),
    (0, express_validator_1.body)("branch_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("user_id")
        .optional()
        .isString(),
];
exports.updateLabOrderItemValidation = [
    (0, express_validator_1.body)("lab_order_id")
        .optional()
        .notEmpty()
        .withMessage("Lab Order ID cannot be empty"),
    (0, express_validator_1.body)("lab_test_id")
        .optional()
        .notEmpty()
        .withMessage("Lab Test ID cannot be empty"),
    (0, express_validator_1.body)("quantity")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Quantity must be a positive integer"),
    (0, express_validator_1.body)("discount")
        .optional()
        .isNumeric()
        .withMessage("Discount must be a number"),
    (0, express_validator_1.body)("remarks")
        .optional()
        .isString()
        .withMessage("Remarks must be a string"),
];
