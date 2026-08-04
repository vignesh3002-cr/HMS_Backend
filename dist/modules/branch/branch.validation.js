"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignAdminValidation = exports.getAssignableAdminsValidation = exports.updateBranchValidation = exports.createBranchValidation = void 0;
const express_validator_1 = require("express-validator");
// Normalizes missing or empty values to null (not the string "null") so the
// DB column is actually cleared instead of silently keeping its old value.
const nullIfEmpty = (value) => value === undefined || value === null || value === "" ? null : value;
exports.createBranchValidation = [
    (0, express_validator_1.body)("branch_code")
        .optional()
        .notEmpty()
        .withMessage("Branch Code cannot be empty"),
    (0, express_validator_1.body)("branch_name")
        .notEmpty()
        .withMessage("Branch Name is required"),
    (0, express_validator_1.body)("branch_type")
        .notEmpty()
        .withMessage("Branch Type is required"),
    (0, express_validator_1.body)("email")
        .optional()
        .isEmail()
        .withMessage("Valid Branch Email is required"),
    (0, express_validator_1.body)("pincode")
        .optional({ values: "null" })
        .customSanitizer(nullIfEmpty)
        .isInt()
        .withMessage("Pincode must be a number"),
    (0, express_validator_1.body)("total_beds")
        .optional({ values: "null" })
        .customSanitizer(nullIfEmpty)
        .isInt()
        .withMessage("Total beds must be a number"),
    (0, express_validator_1.body)("date_of_establish")
        .optional({ values: "null" })
        .customSanitizer(nullIfEmpty)
        .isISO8601()
        .withMessage("Date of establish must be a valid date"),
    // Optional fields — missing or empty values are normalized to null so the
    // DB column is actually cleared instead of silently keeping its old value.
    (0, express_validator_1.body)("emergency_number").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("address").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("area").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("district").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("state_name").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("country").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("license_number").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("total_no_emp").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("fax_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("gst_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("pan_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("website_address").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("medical_services").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    // Admin Mode validation
    (0, express_validator_1.body)("admin_mode")
        .notEmpty()
        .withMessage("Admin mode is required")
        .isIn(["EXISTING", "NEW"])
        .withMessage("Admin mode must be EXISTING or NEW"),
    (0, express_validator_1.body)("admin_user_id")
        .if((0, express_validator_1.body)("admin_mode").equals("EXISTING"))
        .notEmpty()
        .withMessage("Admin User ID is required when admin_mode is EXISTING"),
    (0, express_validator_1.body)("admin.first_name")
        .if((0, express_validator_1.body)("admin_mode").equals("NEW"))
        .notEmpty()
        .withMessage("Admin First Name is required when admin_mode is NEW"),
    (0, express_validator_1.body)("admin.email")
        .if((0, express_validator_1.body)("admin_mode").equals("NEW"))
        .isEmail()
        .withMessage("Valid Admin Email is required when admin_mode is NEW"),
    (0, express_validator_1.body)("admin.mobile_no")
        .if((0, express_validator_1.body)("admin_mode").equals("NEW"))
        .notEmpty()
        .withMessage("Admin Mobile is required when admin_mode is NEW"),
    (0, express_validator_1.body)("admin.username")
        .if((0, express_validator_1.body)("admin_mode").equals("NEW"))
        .notEmpty()
        .withMessage("Admin Username is required when admin_mode is NEW"),
    (0, express_validator_1.body)("admin.password")
        .if((0, express_validator_1.body)("admin_mode").equals("NEW"))
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters"),
];
exports.updateBranchValidation = [
    (0, express_validator_1.body)("branch_name")
        .optional()
        .notEmpty()
        .withMessage("Branch Name cannot be empty"),
    (0, express_validator_1.body)("branch_type")
        .optional()
        .notEmpty()
        .withMessage("Branch Type cannot be empty"),
    (0, express_validator_1.body)("email")
        .optional()
        .isEmail()
        .withMessage("Valid Branch Email is required"),
    (0, express_validator_1.body)("pincode")
        .optional({ values: "null" })
        .customSanitizer(nullIfEmpty)
        .isInt()
        .withMessage("Pincode must be a number"),
    (0, express_validator_1.body)("total_beds")
        .optional({ values: "null" })
        .customSanitizer(nullIfEmpty)
        .isInt()
        .withMessage("Total beds must be a number"),
    (0, express_validator_1.body)("date_of_establish")
        .optional({ values: "null" })
        .customSanitizer(nullIfEmpty)
        .isISO8601()
        .withMessage("Date of establish must be a valid date"),
    // Optional fields — missing or empty values are normalized to null so the
    // DB column is actually cleared instead of silently keeping its old value.
    (0, express_validator_1.body)("emergency_number").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("address").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("area").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("district").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("state_name").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("country").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("license_number").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("total_no_emp").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("fax_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("gst_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("pan_no").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("website_address").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("medical_services").optional({ values: "null" }).customSanitizer(nullIfEmpty),
    (0, express_validator_1.body)("branch_status")
        .optional()
        .isIn(["Active", "Inactive"])
        .withMessage("Branch status must be either Active or Inactive"),
];
exports.getAssignableAdminsValidation = [
    (0, express_validator_1.query)("search")
        .optional()
        .isString()
        .trim(),
];
exports.assignAdminValidation = [
    (0, express_validator_1.body)("user_id")
        .notEmpty()
        .withMessage("User ID is required"),
];
