import { body, param, query } from "express-validator";
import { PHARMACY_SLIP_STATUS_VALUES } from "./pharmacy.constants";

/*
 * The slip id is a generated PSL... string rather than a numeric key, so the
 * same non-empty / length check the other generated-id modules use applies.
 */
const slipIdValidation = param("pharmacySlipId")
    .notEmpty()
    .withMessage("Pharmacy slip ID is required")
    .isLength({ max: 100 })
    .withMessage("Pharmacy slip ID is too long");

export const previewSlipValidation = [

    param("planId")
        .notEmpty()
        .withMessage("Chemotherapy plan ID is required")

];

export const createSlipValidation = [

    body("plan_id")
        .notEmpty()
        .withMessage("Chemotherapy plan ID is required")

];

export const listSlipsValidation = [

    query("status")
        .optional()
        .isIn(PHARMACY_SLIP_STATUS_VALUES)
        .withMessage(`Status must be one of: ${PHARMACY_SLIP_STATUS_VALUES.join(", ")}`),

    query("plan_id").optional().isString(),

    query("patient_id").optional().isString(),

    query("branch_id").optional().isString(),

    query("appointment_id").optional().isString(),

    query("cycle_number").optional().isInt({ min: 1 }).withMessage("Cycle number must be a positive integer"),

    query("date_from").optional().isISO8601().withMessage("date_from must be a valid date"),

    query("date_to").optional().isISO8601().withMessage("date_to must be a valid date"),

    query("search").optional().isString().isLength({ max: 100 }),

    query("page").optional().isInt({ min: 1 }).withMessage("Page must be 1 or greater"),

    query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be between 1 and 200")

];

export const getSlipValidation = [slipIdValidation];

// Editable fields on a line: quantity, brand_name, dose, dose_unit, etc.
export const updateSlipItemsValidation = [

    slipIdValidation,

    body("items")
        .isArray({ min: 1 })
        .withMessage("At least one slip item is required"),

    body("items.*.pharmacy_slip_item_id")
        .optional({ nullable: true })
        .isString(),

    body("items.*.quantity")
        .optional({ nullable: true })
        .isInt({ min: 0 })
        .withMessage("Quantity must be a whole number of zero or greater"),

    body("items.*.brand_name")
        .optional({ nullable: true })
        .isString(),

    body("items.*.dose")
        .optional({ nullable: true })
        .isString(),

    body("items.*.dose_unit")
        .optional({ nullable: true })
        .isString(),

    body("items.*.patient_dose")
        .optional({ nullable: true })
        .isString(),

    body("items.*.drug_name")
        .optional({ nullable: true })
        .isString(),

    body("items.*.medicine_id")
        .optional({ nullable: true })
        .isString()

];

export const createMedicineValidation = [

    body("medicine_name")
        .notEmpty()
        .withMessage("Medicine name is required")
        .isLength({ max: 255 })
        .withMessage("Medicine name cannot exceed 255 characters"),

    body("generic_name")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 255 }),

    body("dosage_form")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 100 })

];

export const cancelSlipValidation = [

    slipIdValidation,

    body("reason")
        .notEmpty()
        .withMessage("A cancellation reason is required")
        .isLength({ max: 500 })
        .withMessage("Cancellation reason cannot exceed 500 characters")

];

export const printSlipValidation = [

    slipIdValidation,

    body("printed_by")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 100 })
        .withMessage("Printed by cannot exceed 100 characters")

];