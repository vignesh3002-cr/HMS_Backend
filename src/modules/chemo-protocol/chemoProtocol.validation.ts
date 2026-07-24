import { body } from "express-validator";

export const createProtocolValidation = [

    body("protocol_code")
        .notEmpty()
        .withMessage("Protocol code is required (e.g. FOLFOX)")
        .isLength({ max: 30 }),

    body("protocol_name")
        .notEmpty()
        .withMessage("Protocol name is required")
        .isLength({ max: 200 }),

    body("cancer_type_id")
        .optional()
        .isString(),

    body("cancer_stage_id")
        .optional()
        .isString(),

    body("treatment_intent_id")
        .optional()
        .isString(),

    body("cycle_length_days")
        .optional()
        .isInt({ min: 1 })
        .withMessage("cycle_length_days must be a positive integer"),

    body("total_recommended_cycles")
        .optional()
        .isInt({ min: 1 })
        .withMessage("total_recommended_cycles must be a positive integer"),

    body("protocol_description")
        .optional()
        .isString(),

    body("reference_guideline")
        .optional()
        .isString()

];

export const updateProtocolValidation = [

    body("protocol_name")
        .optional()
        .isLength({ max: 200 }),

    body("cycle_length_days")
        .optional()
        .isInt({ min: 1 }),

    body("total_recommended_cycles")
        .optional()
        .isInt({ min: 1 }),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];

export const addProtocolDrugValidation = [

    body("drug_id")
        .notEmpty()
        .withMessage("drug_id is required"),

    body("administration_day")
        .optional()
        .isString(),

    body("dose")
        .optional()
        .isString(),

    body("sequence_order")
        .optional()
        .isInt({ min: 1 })
        .withMessage("sequence_order must be a positive integer"),

    body("infusion_duration")
        .optional()
        .isString()

];

export const updateProtocolDrugValidation = [

    body("administration_day")
        .optional()
        .isString(),

    body("dose")
        .optional()
        .isString(),

    body("sequence_order")
        .optional()
        .isInt({ min: 1 }),

    body("infusion_duration")
        .optional()
        .isString(),

    body("is_active")
        .optional()
        .isBoolean()

];
