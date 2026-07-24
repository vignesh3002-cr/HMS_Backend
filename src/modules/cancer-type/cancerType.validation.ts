import { body, param } from "express-validator";

export const createCancerTypeValidation = [

    
     

    body("cancer_type_name")
        .notEmpty()
        .withMessage("Cancer type name is required")
        .isLength({ max: 200 })
        .withMessage("Cancer type name must not exceed 200 characters"),

    body("cancer_category")
        .optional()
        .isString(),

    body("icd_o3_code")
        .optional()
        .isString(),

    body("description")
        .optional()
        .isString()

];

export const updateCancerTypeValidation = [

    param("cancerTypeId")
        .notEmpty()
        .withMessage("Cancer type id is required"),

    body("cancer_type_name")
        .optional()
        .isLength({ max: 200 })
        .withMessage("Cancer type name must not exceed 200 characters"),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
