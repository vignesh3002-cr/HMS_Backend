import { body } from "express-validator";

export const createTnmStageValidation = [

    body("cancer_type_id")
        .optional()
        .isString(),

    body("t_category")
        .optional()
        .isLength({ max: 10 })
        .withMessage("T category must not exceed 10 characters"),

    body("n_category")
        .optional()
        .isLength({ max: 10 })
        .withMessage("N category must not exceed 10 characters"),

    body("m_category")
        .optional()
        .isLength({ max: 10 })
        .withMessage("M category must not exceed 10 characters"),

    body("tnm_combined_code")
        .notEmpty()
        .withMessage("Combined TNM code is required (e.g. T2N1M0)")
        .isLength({ max: 30 }),

    body("staging_edition")
        .optional()
        .isString(),

    body("overall_stage_group")
        .optional()
        .isString()

];

export const updateTnmStageValidation = [

    body("tnm_combined_code")
        .optional()
        .isLength({ max: 30 }),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
