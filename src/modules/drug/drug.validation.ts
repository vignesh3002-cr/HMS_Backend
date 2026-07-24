import { body } from "express-validator";

export const createDrugValidation = [

    body("drug_code")
        .notEmpty()
        .withMessage("Drug code is required")
        .isLength({ max: 30 })
        .withMessage("Drug code must not exceed 30 characters"),

    body("drug_name")
        .notEmpty()
        .withMessage("Drug name is required")
        .isLength({ max: 200 })
        .withMessage("Drug name must not exceed 200 characters"),

    body("generic_name")
        .optional()
        .isString(),

    body("brand_name")
        .optional()
        .isString(),

    body("drug_class")
        .optional()
        .isString(),

    body("vesicant_status")
        .optional()
        .isIn(["Vesicant", "Irritant", "Non-vesicant"])
        .withMessage("vesicant_status must be one of Vesicant, Irritant, Non-vesicant"),

    body("administration_route")
        .optional()
        .isString(),

    body("standard_unit")
        .optional()
        .isString(),

    body("max_dose_per_cycle")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("max_dose_per_cycle must be a positive number"),

    body("is_high_alert")
        .optional()
        .isBoolean(),

    body("linked_medicine_id")
        .optional()
        .isString()

];

export const updateDrugValidation = [

    body("drug_name")
        .optional()
        .isLength({ max: 200 }),

    body("vesicant_status")
        .optional()
        .isIn(["Vesicant", "Irritant", "Non-vesicant"])
        .withMessage("vesicant_status must be one of Vesicant, Irritant, Non-vesicant"),

    body("max_dose_per_cycle")
        .optional()
        .isFloat({ min: 0 }),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
