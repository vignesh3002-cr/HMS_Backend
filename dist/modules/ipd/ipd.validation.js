"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBedValidation = exports.createWardValidation = exports.getAdmissionByIpNumberValidation = exports.getAdmissionsValidation = exports.IPD_SORT_FIELDS = exports.transferAdmissionValidation = exports.dischargeAdmissionValidation = exports.updateAdmissionValidation = exports.createAdmissionValidation = void 0;
const express_validator_1 = require("express-validator");
const ipd_constants_1 = require("./ipd.constants");
exports.createAdmissionValidation = [
    (0, express_validator_1.body)("patient_id")
        .notEmpty()
        .withMessage("Patient is required"),
    (0, express_validator_1.body)("branch_id")
        .notEmpty()
        .withMessage("Branch is required"),
    (0, express_validator_1.body)("admission_type")
        .optional()
        .isIn(ipd_constants_1.ADMISSION_TYPE_VALUES)
        .withMessage(`Admission type must be one of: ${ipd_constants_1.ADMISSION_TYPE_VALUES.join(", ")}`),
    (0, express_validator_1.body)("appointment_id").optional().isString(),
    (0, express_validator_1.body)("department_id").optional().isString(),
    (0, express_validator_1.body)("employee_id").optional().isString(),
    (0, express_validator_1.body)("ward_id").optional().isString(),
    (0, express_validator_1.body)("bed_id").optional().isString(),
    (0, express_validator_1.body)("is_daycare").optional().isBoolean(),
    (0, express_validator_1.body)("payment_mode").optional().isString(),
    (0, express_validator_1.body)("insurance_provider").optional().isString(),
    (0, express_validator_1.body)("insurance_policy_no").optional().isString(),
    (0, express_validator_1.body)("expected_stay_days").optional().isFloat({ min: 0, max: 99.99 }),
    (0, express_validator_1.body)("advance_amount").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("provisional_diagnosis").optional().isString(),
    (0, express_validator_1.body)("admission_date").optional().isISO8601(),
    (0, express_validator_1.body)("status").optional().isIn(ipd_constants_1.IPD_STATUS_VALUES),
];
exports.updateAdmissionValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
    (0, express_validator_1.body)("ward_id").optional().isString(),
    (0, express_validator_1.body)("bed_id").optional().isString(),
    (0, express_validator_1.body)("department_id").optional().isString(),
    (0, express_validator_1.body)("employee_id").optional().isString(),
    (0, express_validator_1.body)("admission_type").optional().isIn(ipd_constants_1.ADMISSION_TYPE_VALUES),
    (0, express_validator_1.body)("payment_mode").optional().isString(),
    (0, express_validator_1.body)("insurance_provider").optional().isString(),
    (0, express_validator_1.body)("insurance_policy_no").optional().isString(),
    (0, express_validator_1.body)("expected_stay_days").optional().isFloat({ min: 0, max: 99.99 }),
    (0, express_validator_1.body)("advance_amount").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("provisional_diagnosis").optional().isString(),
    (0, express_validator_1.body)("is_daycare").optional().isBoolean(),
    (0, express_validator_1.body)("admission_date")
        .optional()
        .isISO8601()
        .withMessage("Admission date must be a valid date"),
    (0, express_validator_1.body)("discharge_date")
        .optional()
        .isISO8601()
        .withMessage("Discharge date must be a valid date"),
    (0, express_validator_1.body)("discharge_type").optional().isIn(ipd_constants_1.DISCHARGE_TYPE_VALUES),
    (0, express_validator_1.body)("discharge_summary").optional().isString(),
    (0, express_validator_1.body)("status").optional().isIn(ipd_constants_1.IPD_STATUS_VALUES),
];
exports.dischargeAdmissionValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
    (0, express_validator_1.body)("discharge_type").optional().isIn(ipd_constants_1.DISCHARGE_TYPE_VALUES),
    (0, express_validator_1.body)("discharge_summary").optional().isString(),
    (0, express_validator_1.body)("discharge_date").optional().isISO8601(),
];
exports.transferAdmissionValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
    (0, express_validator_1.body)("targetWardId")
        .notEmpty()
        .withMessage("Target ward is required"),
    (0, express_validator_1.body)("targetBedId")
        .notEmpty()
        .withMessage("Target bed is required"),
    (0, express_validator_1.body)("reason").optional().isString(),
];
exports.IPD_SORT_FIELDS = [
    "ip_number",
    "patient",
    "branch",
    "ward_bed",
    "admission_date",
    "doctor",
    "status",
];
exports.getAdmissionsValidation = [
    (0, express_validator_1.query)("page").optional().isInt({ min: 1 }),
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)("status")
        .optional()
        .custom((value) => value.split(",").every((s) => ipd_constants_1.IPD_STATUS_VALUES.includes(s.trim())))
        .withMessage(`Status must be one of: ${ipd_constants_1.IPD_STATUS_VALUES.join(", ")}`),
    (0, express_validator_1.query)("wardId").optional().isString(),
    (0, express_validator_1.query)("patientId").optional().isString(),
    (0, express_validator_1.query)("date").optional().isISO8601().withMessage("Date must be a valid date (yyyy-MM-dd)"),
    (0, express_validator_1.query)("search").optional().isString(),
    (0, express_validator_1.query)("sortField").optional().isIn(exports.IPD_SORT_FIELDS),
    (0, express_validator_1.query)("sortDirection").optional().isIn(["asc", "desc"]),
];
exports.getAdmissionByIpNumberValidation = [
    (0, express_validator_1.param)("ipNumber")
        .notEmpty()
        .withMessage("IP number is required"),
];
exports.createWardValidation = [
    (0, express_validator_1.body)("ward_name").trim().notEmpty().withMessage("Ward name is required"),
    (0, express_validator_1.body)("branch_id").trim().notEmpty().withMessage("Branch ID is required"),
    (0, express_validator_1.body)("ward_type").optional().trim().isString(),
    (0, express_validator_1.body)("floor").optional().trim().isString(),
    (0, express_validator_1.body)("total_beds").optional().isInt({ min: 0 }).withMessage("Total beds must be a non-negative integer"),
    (0, express_validator_1.body)("tariff").optional().isNumeric().withMessage("Tariff must be a valid number"),
];
exports.createBedValidation = [
    (0, express_validator_1.body)("ward_id").trim().notEmpty().withMessage("Ward ID is required"),
    (0, express_validator_1.body)("bed_number").trim().notEmpty().withMessage("Bed number is required"),
    (0, express_validator_1.body)("branch_id").optional().trim().isString(),
    (0, express_validator_1.body)("bed_type").optional().trim().isString(),
    (0, express_validator_1.body)("tariff").optional().isNumeric().withMessage("Tariff must be a valid number"),
    (0, express_validator_1.body)("status").optional().trim().isString(),
];
