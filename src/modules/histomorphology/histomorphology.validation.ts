import { body } from "express-validator";

export const createHistomorphologyValidation = [

    body("morphology_code")
        .notEmpty()
        .withMessage("Morphology code is required (e.g. ICD-O-3 code 8140/3)")
        .isLength({ max: 20 })
        .withMessage("Morphology code must not exceed 20 characters"),

    body("morphology_name")
        .notEmpty()
        .withMessage("Morphology name is required")
        .isLength({ max: 300 })
        .withMessage("Morphology name must not exceed 300 characters"),

    body("behavior")
        .optional()
        .isIn(["Benign", "Malignant", "In-situ", "Uncertain"])
        .withMessage("Behavior must be one of Benign, Malignant, In-situ, Uncertain"),

    body("description")
        .optional()
        .isString()

];

export const updateHistomorphologyValidation = [

    body("morphology_name")
        .optional()
        .isLength({ max: 300 }),

    body("behavior")
        .optional()
        .isIn(["Benign", "Malignant", "In-situ", "Uncertain"])
        .withMessage("Behavior must be one of Benign, Malignant, In-situ, Uncertain"),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
