import { body, param, query } from "express-validator";
import {
    IPD_STATUS_VALUES,
    ADMISSION_TYPE_VALUES,
    DISCHARGE_TYPE_VALUES,
    PAYMENT_MODE_VALUES
} from "./ipd.constants";

export const createAdmissionValidation = [

    body("patient_id")
        .notEmpty()
        .withMessage("Patient is required"),

    body("branch_id")
        .notEmpty()
        .withMessage("Branch is required"),

    body("admission_type")
        .optional()
        .isIn(ADMISSION_TYPE_VALUES)
        .withMessage(`Admission type must be one of: ${ADMISSION_TYPE_VALUES.join(", ")}`),

    body("appointment_id").optional().isString(),
    body("department_id").optional().isString(),
    body("employee_id").optional().isString(),
    body("ward_id").optional().isString(),
    body("bed_id").optional().isString(),
    body("is_daycare").optional().isBoolean(),
    body("payment_mode").optional().isString(),
    body("insurance_provider").optional().isString(),
    body("insurance_policy_no").optional().isString(),
    body("expected_stay_days").optional().isFloat({ min: 0, max: 99.99 }),
    body("advance_amount").optional().isFloat({ min: 0 }),
    body("provisional_diagnosis").optional().isString(),
    body("admission_date").optional().isISO8601(),
    body("status").optional().isIn(IPD_STATUS_VALUES),

];

export const updateAdmissionValidation = [

    param("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),

    body("ward_id").optional().isString(),
    body("bed_id").optional().isString(),
    body("department_id").optional().isString(),
    body("employee_id").optional().isString(),
    body("admission_type").optional().isIn(ADMISSION_TYPE_VALUES),
    body("payment_mode").optional().isString(),
    body("insurance_provider").optional().isString(),
    body("insurance_policy_no").optional().isString(),
    body("expected_stay_days").optional().isFloat({ min: 0, max: 99.99 }),
    body("advance_amount").optional().isFloat({ min: 0 }),
    body("provisional_diagnosis").optional().isString(),
    body("is_daycare").optional().isBoolean(),
    body("admission_date")
        .optional()
        .isISO8601()
        .withMessage("Admission date must be a valid date"),
    body("discharge_date")
        .optional()
        .isISO8601()
        .withMessage("Discharge date must be a valid date"),
    body("discharge_type").optional().isIn(DISCHARGE_TYPE_VALUES),
    body("discharge_summary").optional().isString(),
    body("status").optional().isIn(IPD_STATUS_VALUES),

];

export const dischargeAdmissionValidation = [

    param("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),

    body("discharge_type").optional().isIn(DISCHARGE_TYPE_VALUES),
    body("discharge_summary").optional().isString(),
    body("discharge_date").optional().isISO8601(),

];

export const transferAdmissionValidation = [

    param("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),

    body("targetWardId")
        .notEmpty()
        .withMessage("Target ward is required"),

    body("targetBedId")
        .notEmpty()
        .withMessage("Target bed is required"),

    body("reason").optional().isString(),

];

export const IPD_SORT_FIELDS = [
    "ip_number",
    "patient",
    "branch",
    "ward_bed",
    "admission_date",
    "doctor",
    "status",
];

export const getAdmissionsValidation = [

    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status")
        .optional()
        .custom((value: string) => value.split(",").every((s) => IPD_STATUS_VALUES.includes(s.trim())))
        .withMessage(`Status must be one of: ${IPD_STATUS_VALUES.join(", ")}`),
    query("wardId").optional().isString(),
    query("patientId").optional().isString(),
    query("date").optional().isISO8601().withMessage("Date must be a valid date (yyyy-MM-dd)"),
    query("search").optional().isString(),
    query("sortField").optional().isIn(IPD_SORT_FIELDS),
    query("sortDirection").optional().isIn(["asc", "desc"]),

];

export const getAdmissionByIpNumberValidation = [

    param("ipNumber")
        .notEmpty()
        .withMessage("IP number is required"),

];

export const createWardValidation = [
    body("ward_name").trim().notEmpty().withMessage("Ward name is required"),
    body("branch_id").trim().notEmpty().withMessage("Branch ID is required"),
    body("ward_type").optional().trim().isString(),
    body("floor").optional().trim().isString(),
    body("total_beds").optional().isInt({ min: 0 }).withMessage("Total beds must be a non-negative integer"),
    body("tariff").optional().isNumeric().withMessage("Tariff must be a valid number"),
];

export const createBedValidation = [
    body("ward_id").trim().notEmpty().withMessage("Ward ID is required"),
    body("bed_number").trim().notEmpty().withMessage("Bed number is required"),
    body("branch_id").optional().trim().isString(),
    body("bed_type").optional().trim().isString(),
    body("tariff").optional().isNumeric().withMessage("Tariff must be a valid number"),
    body("status").optional().trim().isString(),
];

