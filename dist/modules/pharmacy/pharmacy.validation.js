"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.amendSlipValidation = exports.issueSlipValidation = exports.printSlipValidation = exports.cancelSlipValidation = exports.createMedicineValidation = exports.updateSlipItemsValidation = exports.getSlipValidation = exports.listSlipsValidation = exports.createSlipValidation = exports.previewSlipValidation = void 0;
const express_validator_1 = require("express-validator");
const pharmacy_constants_1 = require("./pharmacy.constants");
/*
 * The slip id is a generated PSL... string rather than a numeric key, so the
 * same non-empty / length check the other generated-id modules use applies.
 */
const slipIdValidation = (0, express_validator_1.param)("pharmacySlipId")
    .notEmpty()
    .withMessage("Pharmacy slip ID is required")
    .isLength({ max: 100 })
    .withMessage("Pharmacy slip ID is too long");
exports.previewSlipValidation = [
    (0, express_validator_1.param)("planId")
        .notEmpty()
        .withMessage("Chemotherapy plan ID is required")
];
exports.createSlipValidation = [
    (0, express_validator_1.body)("plan_id")
        .notEmpty()
        .withMessage("Chemotherapy plan ID is required")
];
exports.listSlipsValidation = [
    (0, express_validator_1.query)("status")
        .optional()
        .isIn(pharmacy_constants_1.PHARMACY_SLIP_STATUS_VALUES)
        .withMessage(`Status must be one of: ${pharmacy_constants_1.PHARMACY_SLIP_STATUS_VALUES.join(", ")}`),
    (0, express_validator_1.query)("plan_id").optional().isString(),
    (0, express_validator_1.query)("patient_id").optional().isString(),
    (0, express_validator_1.query)("branch_id").optional().isString(),
    (0, express_validator_1.query)("appointment_id").optional().isString(),
    (0, express_validator_1.query)("cycle_number").optional().isInt({ min: 1 }).withMessage("Cycle number must be a positive integer"),
    (0, express_validator_1.query)("date_from").optional().isISO8601().withMessage("date_from must be a valid date"),
    (0, express_validator_1.query)("date_to").optional().isISO8601().withMessage("date_to must be a valid date"),
    (0, express_validator_1.query)("search").optional().isString().isLength({ max: 100 }),
    (0, express_validator_1.query)("page").optional().isInt({ min: 1 }).withMessage("Page must be 1 or greater"),
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be between 1 and 200")
];
exports.getSlipValidation = [slipIdValidation];
// Editable fields on a line: quantity, brand_name, dose, dose_unit, etc.
exports.updateSlipItemsValidation = [
    slipIdValidation,
    (0, express_validator_1.body)("items")
        .isArray({ min: 1 })
        .withMessage("At least one slip item is required"),
    (0, express_validator_1.body)("items.*.pharmacy_slip_item_id")
        .optional({ nullable: true })
        .isString(),
    (0, express_validator_1.body)("items.*.quantity")
        .optional({ nullable: true })
        .isInt({ min: 0 })
        .withMessage("Quantity must be a whole number of zero or greater"),
    (0, express_validator_1.body)("items.*.brand_name")
        .optional({ nullable: true })
        .isString(),
    (0, express_validator_1.body)("items.*.dose")
        .optional({ nullable: true })
        .isString(),
    (0, express_validator_1.body)("items.*.dose_unit")
        .optional({ nullable: true })
        .isString(),
    (0, express_validator_1.body)("items.*.patient_dose")
        .optional({ nullable: true })
        .isString(),
    (0, express_validator_1.body)("items.*.drug_name")
        .optional({ nullable: true })
        .isString(),
    (0, express_validator_1.body)("items.*.medicine_id")
        .optional({ nullable: true })
        .isString()
];
exports.createMedicineValidation = [
    (0, express_validator_1.body)("medicine_name")
        .notEmpty()
        .withMessage("Medicine name is required")
        .isLength({ max: 255 })
        .withMessage("Medicine name cannot exceed 255 characters"),
    (0, express_validator_1.body)("generic_name")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 255 }),
    (0, express_validator_1.body)("dosage_form")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 100 })
];
exports.cancelSlipValidation = [
    slipIdValidation,
    (0, express_validator_1.body)("reason")
        .notEmpty()
        .withMessage("A cancellation reason is required")
        .isLength({ max: 500 })
        .withMessage("Cancellation reason cannot exceed 500 characters")
];
exports.printSlipValidation = [
    slipIdValidation,
    (0, express_validator_1.body)("printed_by")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 100 })
        .withMessage("Printed by cannot exceed 100 characters")
];
exports.issueSlipValidation = [
    slipIdValidation,
    (0, express_validator_1.body)("note").optional({ nullable: true }).isString().isLength({ max: 500 })
];
exports.amendSlipValidation = [
    ...exports.updateSlipItemsValidation,
    (0, express_validator_1.body)("reason")
        .notEmpty().withMessage("An amendment reason is required")
        .isLength({ max: 500 })
        .withMessage("Amendment reason cannot exceed 500 characters")
];
