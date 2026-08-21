import { body } from "express-validator";

export const createLabTestCategoryValidation = [

  body("category_name")
    .notEmpty()
    .withMessage("Category Name is required"),

  body("category_code")
    .notEmpty()
    .withMessage("Category Code is required"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),

  body("display_order")
    .optional()
    .isInt()
    .withMessage("Display Order must be a number"),

  body("category_status")
    .optional()
    .isIn([0, 1])
    .withMessage("Category Status must be 0 or 1"),
];

export const updateLabTestCategoryValidation = [

  body("category_name")
    .optional()
    .notEmpty()
    .withMessage("Category Name cannot be empty"),

  body("category_code")
    .optional()
    .notEmpty()
    .withMessage("Category Code cannot be empty"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),

  body("display_order")
    .optional()
    .isInt()
    .withMessage("Display Order must be a number"),

  body("category_status")
    .optional()
    .isIn([0, 1])
    .withMessage("Category Status must be 0 or 1"),
];