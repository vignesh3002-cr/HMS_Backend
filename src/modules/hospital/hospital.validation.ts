import { body, param, query } from "express-validator";

export const createHospitalValidation = [
  body("hospital_name")
    .notEmpty()
    .withMessage("Hospital name is required")
    .isLength({ max: 100 })
    .withMessage("Hospital name cannot exceed 100 characters"),
  body("hospital_address")
    .optional()
    .isLength({ max: 300 })
    .withMessage("Address cannot exceed 300 characters"),
  body("contact_number")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Contact number cannot exceed 100 characters"),
  body("email_id")
    .optional()
    .isEmail()
    .withMessage("Invalid email format"),
  body("website_address")
    .optional()
    .isURL()
    .withMessage("Invalid website URL"),
  body("hospital_type")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Hospital type cannot exceed 100 characters"),
  body("hospital_license_no")
    .optional()
    .isLength({ max: 100 })
    .withMessage("License number cannot exceed 100 characters"),
  body("hospital_country")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),
  body("hospital_state")
    .optional()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters"),
  body("hospital_district")
    .optional()
    .isLength({ max: 100 })
    .withMessage("District cannot exceed 100 characters"),
  body("hospital_area")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Area cannot exceed 100 characters"),
  body("pincode")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Pincode cannot exceed 100 characters"),
  body("timezone")
    .optional()
    .isLength({ max: 64 })
    .withMessage("Invalid timezone"),
];

export const updateHospitalValidation = [
  param("hospitalId")
    .notEmpty()
    .withMessage("Hospital ID is required"),
  body("hospital_name")
    .optional()
    .notEmpty()
    .withMessage("Hospital name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Hospital name cannot exceed 100 characters"),
  body("hospital_address")
    .optional()
    .isLength({ max: 300 })
    .withMessage("Address cannot exceed 300 characters"),
  body("contact_number")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Contact number cannot exceed 100 characters"),
  body("email_id")
    .optional()
    .isEmail()
    .withMessage("Invalid email format"),
  body("website_address")
    .optional()
    .isURL()
    .withMessage("Invalid website URL"),
  body("hospital_type")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Hospital type cannot exceed 100 characters"),
  body("hospital_license_no")
    .optional()
    .isLength({ max: 100 })
    .withMessage("License number cannot exceed 100 characters"),
  body("hospital_country")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),
  body("hospital_state")
    .optional()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters"),
  body("hospital_district")
    .optional()
    .isLength({ max: 100 })
    .withMessage("District cannot exceed 100 characters"),
  body("hospital_area")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Area cannot exceed 100 characters"),
  body("pincode")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Pincode cannot exceed 100 characters"),
  body("timezone")
    .optional()
    .isLength({ max: 64 })
    .withMessage("Invalid timezone"),
];

export const getHospitalValidation = [
  param("hospitalId")
    .notEmpty()
    .withMessage("Hospital ID is required"),
];

export const listHospitalsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];