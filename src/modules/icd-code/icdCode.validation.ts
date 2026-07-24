import { body } from "express-validator";

export const createIcdCodeValidation = [

    body("icd_code")
        .notEmpty()
        .withMessage("ICD code is required (e.g. C50.9)")
        .isLength({ max: 20 })
        .withMessage("ICD code must not exceed 20 characters"),

    body("icd_version")
        .optional()
        .isIn(["ICD-10", "ICD-11", "ICD-O-3"])
        .withMessage("ICD version must be one of ICD-10, ICD-11, ICD-O-3"),

    body("icd_description")
        .notEmpty()
        .withMessage("ICD description is required")
        .isLength({ max: 500 })
        .withMessage("ICD description must not exceed 500 characters"),

    body("icd_category")
        .optional()
        .isString()

];

export const updateIcdCodeValidation = [

    body("icd_description")
        .optional()
        .isLength({ max: 500 }),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
