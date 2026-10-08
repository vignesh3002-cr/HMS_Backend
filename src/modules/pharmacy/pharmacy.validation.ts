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

// Quantity is the only editable field on a line and it counts whole packs.
export const updateSlipItemsValidation = [

    slipIdValidation,

    body("items")
        .isArray({ min: 1 })
        .withMessage("At least one slip item is required"),

    body("items.*.pharmacy_slip_item_id")
        .notEmpty()
        .withMessage("Each item must identify its slip item"),

    body("items.*.quantity")
        .optional({ nullable: true })
        .isInt({ min: 0 })
        .withMessage("Quantity must be a whole number of zero or greater")

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