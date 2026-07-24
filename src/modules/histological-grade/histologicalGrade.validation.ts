import { body } from "express-validator";

export const createHistologicalGradeValidation = [

    body("grade_code")
        .notEmpty()
        .withMessage("Grade code is required (e.g. G1, G2, G3, G4, GX)")
        .isLength({ max: 10 })
        .withMessage("Grade code must not exceed 10 characters"),

    body("grade_name")
        .notEmpty()
        .withMessage("Grade name is required")
        .isLength({ max: 100 })
        .withMessage("Grade name must not exceed 100 characters"),

    body("description")
        .optional()
        .isString()

];

export const updateHistologicalGradeValidation = [

    body("grade_name")
        .optional()
        .isLength({ max: 100 }),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
