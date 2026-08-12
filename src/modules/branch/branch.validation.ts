import { body, query } from "express-validator";

// Normalizes missing or empty values to null (not the string "null") so the
// DB column is actually cleared instead of silently keeping its old value.
const nullIfEmpty = (value: unknown) =>
  value === undefined || value === null || value === "" ? null : value;

export const createBranchValidation = [
  body("branch_code")
    .optional()
    .notEmpty()
    .withMessage("Branch Code cannot be empty"),

  body("branch_name")
    .notEmpty()
    .withMessage("Branch Name is required"),

  body("branch_type")
    .notEmpty()
    .withMessage("Branch Type is required"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Valid Branch Email is required"),

  body("pincode")
    .optional({ values: "null" })
    .customSanitizer(nullIfEmpty)
    .isInt()
    .withMessage("Pincode must be a number"),

  body("total_beds")
    .optional({ values: "null" })
    .customSanitizer(nullIfEmpty)
    .isInt()
    .withMessage("Total beds must be a number"),

  body("date_of_establish")
    .optional({ values: "null" })
    .customSanitizer(nullIfEmpty)
    .isISO8601()
    .withMessage("Date of establish must be a valid date"),

  // Optional fields — missing or empty values are normalized to null so the
  // DB column is actually cleared instead of silently keeping its old value.
  body("emergency_number").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("address").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("area").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("district").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("state_name").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("country").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("license_number").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("total_no_emp").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("fax_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("gst_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("pan_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("website_address").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("medical_services").optional({ values: "null" }).customSanitizer(nullIfEmpty),

  // Admin Mode validation
  body("admin_mode")
    .notEmpty()
    .withMessage("Admin mode is required")
    .isIn(["EXISTING", "NEW"])
    .withMessage("Admin mode must be EXISTING or NEW"),

  body("admin_user_id")
    .if(body("admin_mode").equals("EXISTING"))
    .notEmpty()
    .withMessage("Admin User ID is required when admin_mode is EXISTING"),

  body("admin.first_name")
    .if(body("admin_mode").equals("NEW"))
    .notEmpty()
    .withMessage("Admin First Name is required when admin_mode is NEW"),

  body("admin.email")
    .if(body("admin_mode").equals("NEW"))
    .isEmail()
    .withMessage("Valid Admin Email is required when admin_mode is NEW"),

  body("admin.mobile_no")
    .if(body("admin_mode").equals("NEW"))
    .notEmpty()
    .withMessage("Admin Mobile is required when admin_mode is NEW"),

  body("admin.username")
    .if(body("admin_mode").equals("NEW"))
    .notEmpty()
    .withMessage("Admin Username is required when admin_mode is NEW"),

  body("admin.password")
    .if(body("admin_mode").equals("NEW"))
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

export const updateBranchValidation = [
  body("branch_name")
    .optional()
    .notEmpty()
    .withMessage("Branch Name cannot be empty"),

  body("branch_type")
    .optional()
    .notEmpty()
    .withMessage("Branch Type cannot be empty"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Valid Branch Email is required"),

  body("pincode")
    .optional({ values: "null" })
    .customSanitizer(nullIfEmpty)
    .isInt()
    .withMessage("Pincode must be a number"),

  body("total_beds")
    .optional({ values: "null" })
    .customSanitizer(nullIfEmpty)
    .isInt()
    .withMessage("Total beds must be a number"),

  body("date_of_establish")
    .optional({ values: "null" })
    .customSanitizer(nullIfEmpty)
    .isISO8601()
    .withMessage("Date of establish must be a valid date"),

  // Optional fields — missing or empty values are normalized to null so the
  // DB column is actually cleared instead of silently keeping its old value.
  body("emergency_number").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("address").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("area").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("district").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("state_name").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("country").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("license_number").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("total_no_emp").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("fax_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("gst_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("pan_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("website_address").optional({ values: "null" }).customSanitizer(nullIfEmpty),
  body("medical_services").optional({ values: "null" }).customSanitizer(nullIfEmpty),

  body("branch_status")
    .optional()
    .isIn(["Active", "Inactive"])
    .withMessage("Branch status must be either Active or Inactive"),
];

export const getAssignableAdminsValidation = [
  query("search")
    .optional()
    .isString()
    .trim(),
];

export const assignAdminValidation = [
  body("user_id")
    .notEmpty()
    .withMessage("User ID is required"),
];