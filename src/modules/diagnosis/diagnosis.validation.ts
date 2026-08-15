import { body, query, param } from "express-validator";

export const getDiagnosisCategoriesValidation = [
    query("search")
        .optional()
        .isString()
        .trim()
        .withMessage("Search must be a string"),
    query("activeOnly")
        .optional()
        .isBoolean()
        .withMessage("activeOnly must be a boolean"),
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
];

export const getDiagnosesByCategoryValidation = [
    param("categoryId")
        .notEmpty()
        .withMessage("Category ID is required")
        .isString()
        .withMessage("Category ID must be a string"),
    query("search")
        .optional()
        .isString()
        .trim()
        .withMessage("Search must be a string"),
    query("activeOnly")
        .optional()
        .isBoolean()
        .withMessage("activeOnly must be a boolean"),
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
];

export const getDiagnosisByIdValidation = [
    param("diagnosisId")
        .notEmpty()
        .withMessage("Diagnosis ID is required")
        .isString()
        .withMessage("Diagnosis ID must be a string"),
];