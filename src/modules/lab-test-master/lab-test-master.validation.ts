import { body } from "express-validator";

export const createLabTestMasterValidation = [

    body("lab_test_category_id")
        .notEmpty()
        .withMessage("Lab Test Category is required"),

    body("test_name")
        .notEmpty()
        .withMessage("Test Name is required"),

    body("test_code")
        .notEmpty()
        .withMessage("Test Code is required"),

    body("price")
        .optional()
        .isNumeric()
        .withMessage("Price must be numeric"),

    body("tat_hours")
        .optional()
        .isInt()
        .withMessage("TAT Hours must be a number")

];

export const updateLabTestMasterValidation = [

    body("test_name")
        .optional()
        .notEmpty(),

    body("test_code")
        .optional()
        .notEmpty(),

    body("price")
        .optional()
        .isNumeric(),

    body("tat_hours")
        .optional()
        .isInt()

];