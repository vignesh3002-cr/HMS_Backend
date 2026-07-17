"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBranchValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createBranchValidation = [
    (0, express_validator_1.body)("branch_code")
        .notEmpty()
        .withMessage("Branch Code is required"),
    (0, express_validator_1.body)("name")
        .notEmpty()
        .withMessage("Branch Name is required"),
    (0, express_validator_1.body)("branch_type")
        .notEmpty()
        .withMessage("Branch Type is required"),
    (0, express_validator_1.body)("phone")
        .notEmpty()
        .withMessage("Phone Number is required"),
    (0, express_validator_1.body)("email")
        .isEmail()
        .withMessage("Valid Branch Email is required"),
    (0, express_validator_1.body)("address_line1")
        .notEmpty()
        .withMessage("Address is required"),
    (0, express_validator_1.body)("city")
        .notEmpty()
        .withMessage("City is required"),
    (0, express_validator_1.body)("state_name")
        .notEmpty()
        .withMessage("State is required"),
    (0, express_validator_1.body)("country_code")
        .notEmpty()
        .withMessage("Country Code is required"),
    //------------------------------------
    // Branch Admin Details
    //------------------------------------
    (0, express_validator_1.body)("admin_name")
        .notEmpty()
        .withMessage("Branch Admin Name is required"),
    (0, express_validator_1.body)("username")
        .notEmpty()
        .withMessage("Username is required"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 8 })
        .withMessage("Password should contain minimum 8 characters"),
    (0, express_validator_1.body)("mobile")
        .notEmpty()
        .withMessage("Mobile Number is required"),
    (0, express_validator_1.body)("admin_email")
        .isEmail()
        .withMessage("Valid Admin Email is required")
];
