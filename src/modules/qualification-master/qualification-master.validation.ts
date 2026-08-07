import { body } from "express-validator";

export const createQualificationValidation = [
  body("qualification_name")
    .trim()
    .notEmpty()
    .withMessage("Qualification name is required")
    .isLength({ max: 150 })
    .withMessage("Qualification name must not exceed 150 characters"),

  body("designation")
    .trim()
    .notEmpty()
    .withMessage("Designation is required")
    .isLength({ max: 50 })
    .withMessage("Designation must not exceed 50 characters"),

  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be true or false"),
];

export const updateQualificationValidation = [
  body("qualification_name")
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage("Qualification name must not exceed 150 characters"),

  body("designation")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Designation must not exceed 50 characters"),

  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be true or false"),
];