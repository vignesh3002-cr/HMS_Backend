import { body, param, query } from "express-validator";
import {
    IPD_STATUS_VALUES,
    ADMISSION_TYPE_VALUES,
    DISCHARGE_TYPE_VALUES,
    PAYMENT_MODE_VALUES
} from "./ipd.constants";
import { MANUAL_BED_STATUSES } from "./ipd.constants";

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

export const admitAdmissionValidation = [

    param("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),

    body("ward_id").optional().isString(),
    body("bed_id").optional().isString(),

];

// Reserve takes the same optional ward/bed override as admit.
export const reserveBedValidation = admitAdmissionValidation;

// Cancel / no-show of a planned admission, with an optional reason.
export const closePlannedValidation = [

    param("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),

    body("reason")
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage("Reason must be at most 500 characters"),

];

// Daycare booking: doctor slot + PLANNED daycare admission (ward required,
// bed optional, session length more than 0 and at most 1 day).
export const createDaycareValidation = [

    body("patient_id").notEmpty().withMessage("Patient is required"),
    body("branch_id").notEmpty().withMessage("Branch is required"),
    body("department_id").notEmpty().withMessage("Department is required"),
    body("employee_id").notEmpty().withMessage("Doctor is required"),
    body("ward_id").notEmpty().withMessage("Ward is required for a daycare booking"),
    body("bed_id").optional().isString(),
    body("appointment_date")
        .notEmpty().withMessage("Date is required")
        .isISO8601().withMessage("Date must be a valid date"),
    body("appointment_time")
        .notEmpty().withMessage("Time slot is required")
        .matches(/^\d{1,2}:\d{2}(:\d{2})?$/).withMessage("Time slot must be HH:mm"),
    body("expected_stay_days")
        .isFloat({ gt: 0, max: 1 })
        .withMessage("Daycare duration must be more than 0 and at most 24 hours"),
    body("payment_mode").optional().isString(),
    body("advance_amount").optional().isFloat({ min: 0 }),
    body("provisional_diagnosis").optional().isString(),
    body("reason_for_visit").optional().isString(),

];

export const daycareOccupancyValidation = [

    query("wardId").notEmpty().withMessage("Ward is required"),
    query("date").isISO8601().withMessage("Date must be a valid date (yyyy-MM-dd)"),

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

export const updateWardValidation = [

    param("wardId")
        .notEmpty()
        .withMessage("Ward ID is required"),

    body("ward_name").optional().trim().notEmpty().withMessage("Ward name cannot be empty"),
    body("ward_type").optional().trim().isString(),
    body("floor").optional().trim().isString(),
    body("tariff").optional().isNumeric().withMessage("Tariff must be a valid number"),
    body("active_status").optional().isInt({ min: 0, max: 1 }).withMessage("Active status must be 0 or 1"),

];

export const updateBedValidation = [

    param("bedId")
        .notEmpty()
        .withMessage("Bed ID is required"),

    body("bed_number").optional().trim().notEmpty().withMessage("Bed number cannot be empty"),
    body("bed_type").optional().trim().isString(),
    body("tariff").optional().isNumeric().withMessage("Tariff must be a valid number"),
    body("ward_id").optional().trim().isString(),
    body("active_status").optional().isInt({ min: 0, max: 1 }).withMessage("Active status must be 0 or 1"),

];

export const updateBedStatusValidation = [

    param("id")
        .notEmpty()
        .withMessage("Bed ID is required"),

    body("status")
        .notEmpty()
        .withMessage("Status is required")
        .isIn([...MANUAL_BED_STATUSES])
        .withMessage(`Status must be one of: ${MANUAL_BED_STATUSES.join(", ")}`),

    body("remarks").optional().trim().isString(),

];

