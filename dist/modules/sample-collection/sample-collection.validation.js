"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSampleCollectionValidation = exports.createSampleCollectionValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createSampleCollectionValidation = [
    (0, express_validator_1.body)("lab_order_item_id")
        .notEmpty()
        .withMessage("Lab Order Item ID is required"),
    (0, express_validator_1.body)("barcode")
        .optional()
        .isString()
        .withMessage("Barcode must be a string"),
    (0, express_validator_1.body)("container_type")
        .optional()
        .isString()
        .withMessage("Container Type must be a string"),
    (0, express_validator_1.body)("collection_datetime")
        .optional()
        .isISO8601()
        .withMessage("Collection DateTime must be valid"),
    (0, express_validator_1.body)("collected_by")
        .optional()
        .isString()
        .withMessage("Collected By must be valid"),
    (0, express_validator_1.body)("collection_site")
        .optional()
        .isString()
        .withMessage("Collection Site must be a string"),
    (0, express_validator_1.body)("collected_volume")
        .optional()
        .isString()
        .withMessage("Collected Volume must be a string"),
    (0, express_validator_1.body)("collection_status")
        .optional()
        .isIn([
        "Pending",
        "Collected",
        "Rejected"
    ])
        .withMessage("Invalid Collection Status"),
    (0, express_validator_1.body)("rejection_reason")
        .optional()
        .isString(),
    (0, express_validator_1.body)("remarks")
        .optional()
        .isString()
];
exports.updateSampleCollectionValidation = [
    (0, express_validator_1.body)("barcode").optional().isString(),
    (0, express_validator_1.body)("container_type").optional().isString(),
    (0, express_validator_1.body)("collection_datetime")
        .optional()
        .isISO8601(),
    (0, express_validator_1.body)("collected_by")
        .optional()
        .isString(),
    (0, express_validator_1.body)("collection_site")
        .optional()
        .isString(),
    (0, express_validator_1.body)("collected_volume")
        .optional()
        .isString(),
    (0, express_validator_1.body)("collection_status")
        .optional()
        .isIn([
        "Pending",
        "Collected",
        "Rejected"
    ]),
    (0, express_validator_1.body)("rejection_reason")
        .optional()
        .isString(),
    (0, express_validator_1.body)("remarks")
        .optional()
        .isString()
];
