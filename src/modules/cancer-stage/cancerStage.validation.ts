import { body } from "express-validator";

export const createCancerStageValidation = [

    body("stage_code")
        .notEmpty()
        .withMessage("Stage code is required")
        .isLength({ max: 20 })
        .withMessage("Stage code must not exceed 20 characters"),

    body("stage_name")
        .notEmpty()
        .withMessage("Stage name is required")
        .isLength({ max: 100 })
        .withMessage("Stage name must not exceed 100 characters"),

    body("stage_group")
        .optional()
        .isString(),

    body("description")
        .optional()
        .isString()

];

export const updateCancerStageValidation = [

    body("stage_name")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Stage name must not exceed 100 characters"),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
