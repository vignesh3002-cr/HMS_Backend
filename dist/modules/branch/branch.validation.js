"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignAdminValidation = exports.getAssignableAdminsValidation = exports.updateBranchValidation = exports.createBranchValidation = void 0;
const express_validator_1 = require("express-validator");
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
        .optional()
        .isInt()
        .withMessage("Pincode must be a number"),
    (0, express_validator_1.body)("total_beds")
        .optional()
        .isInt()
        .withMessage("Total beds must be a number"),
    (0, express_validator_1.body)("date_of_establish")
        .optional()
        .isISO8601()
        .withMessage("Date of establish must be a valid date"),
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
        .optional()
        .isInt()
        .withMessage("Pincode must be a number"),
    (0, express_validator_1.body)("total_beds")
        .optional()
        .isInt()
        .withMessage("Total beds must be a number"),
    (0, express_validator_1.body)("date_of_establish")
        .optional()
        .isISO8601()
        .withMessage("Date of establish must be a valid date"),
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
