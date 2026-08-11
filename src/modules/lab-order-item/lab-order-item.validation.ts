import { body } from "express-validator";

export const createLabOrderItemValidation = [

  body("lab_order_id")
    .notEmpty()
    .withMessage("Lab Order ID is required"),

  body("lab_test_id")
    .notEmpty()
    .withMessage("Lab Test ID is required"),

  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),

  body("discount")
    .optional()
    .isNumeric()
    .withMessage("Discount must be a number"),

  body("remarks")
    .optional()
    .isString()
    .withMessage("Remarks must be a string"),

  body("branch_id")
    .optional()
    .isString(),

  body("user_id")
    .optional()
    .isString(),

];

export const updateLabOrderItemValidation = [

  body("lab_order_id")
    .optional()
    .notEmpty()
    .withMessage("Lab Order ID cannot be empty"),

  body("lab_test_id")
    .optional()
    .notEmpty()
    .withMessage("Lab Test ID cannot be empty"),

  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),

  body("discount")
    .optional()
    .isNumeric()
    .withMessage("Discount must be a number"),

  body("remarks")
    .optional()
    .isString()
    .withMessage("Remarks must be a string"),

];