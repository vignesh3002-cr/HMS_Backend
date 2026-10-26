"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDischargeTypeValidation = exports.updateBedStatusValidation = exports.updateBedValidation = exports.updateWardValidation = exports.createBedValidation = exports.createWardValidation = exports.getAdmissionByIpNumberValidation = exports.getAdmissionsValidation = exports.IPD_SORT_FIELDS = exports.daycareOccupancyValidation = exports.createDaycareValidation = exports.closePlannedValidation = exports.reserveBedValidation = exports.admitAdmissionValidation = exports.transferAdmissionValidation = exports.saveDischargeDetailsValidation = exports.dischargeAdmissionValidation = exports.updateAdmissionValidation = exports.createAdmissionValidation = exports.getCareTeamValidation = exports.bulkAllocateCareTeamValidation = exports.allocateCareTeamValidation = void 0;
const express_validator_1 = require("express-validator");
const ipd_constants_1 = require("./ipd.constants");
const ipd_constants_2 = require("./ipd.constants");
const careTeamFields = [
    // null clears the role; an omitted field leaves it unchanged.
    (0, express_validator_1.body)("assigned_doctor_id").optional({ values: "null" }).isString().notEmpty(),
    (0, express_validator_1.body)("nurse_id").optional({ values: "null" }).isString().notEmpty(),
    (0, express_validator_1.body)("roster_override").optional().isBoolean().withMessage("roster_override must be true or false"),
    (0, express_validator_1.body)("handover_notes")
        .optional({ values: "falsy" })
        .isString()
        .isLength({ max: 2000 })
        .withMessage("Handover notes must be at most 2000 characters"),
];
exports.allocateCareTeamValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
    ...careTeamFields,
];
exports.bulkAllocateCareTeamValidation = [
    (0, express_validator_1.body)("ward_id").notEmpty().withMessage("Ward is required"),
    (0, express_validator_1.body)("branch_id").notEmpty().withMessage("Branch is required"),
    (0, express_validator_1.body)("admission_ids")
        .isArray({ min: 1, max: ipd_constants_2.CARE_TEAM_BULK_MAX })
        .withMessage(`Select between 1 and ${ipd_constants_2.CARE_TEAM_BULK_MAX} admissions`),
    (0, express_validator_1.body)("admission_ids.*").isString().notEmpty(),
    ...careTeamFields,
];
exports.getCareTeamValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
];
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
    // Any active row of discharge_type_master (checked in the service) --
    // the built-ins plus values added through "Others".
    (0, express_validator_1.body)("discharge_type").optional().isString().isLength({ max: 100 }),
    (0, express_validator_1.body)("discharge_summary").optional().isString(),
    (0, express_validator_1.body)("status").optional().isIn(ipd_constants_1.IPD_STATUS_VALUES),
];
exports.dischargeAdmissionValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
    // Any active row of discharge_type_master (checked in the service) --
    // the built-ins plus values added through "Others".
    (0, express_validator_1.body)("discharge_type").optional().isString().isLength({ max: 100 }),
    (0, express_validator_1.body)("discharge_summary").optional().isString(),
    (0, express_validator_1.body)("discharge_date").optional().isISO8601(),
    (0, express_validator_1.body)("discharge_advice").optional().isString(),
    (0, express_validator_1.body)("review_date").optional().isISO8601(),
    // Free text, same denormalized pattern as oncology_staging_detail's --
    // not validated against disease_status_master (see ipd.service.ts).
    (0, express_validator_1.body)("discharge_disease_status").optional().isString(),
    (0, express_validator_1.body)("patient_status_at_discharge").optional().isIn(ipd_constants_1.PATIENT_STATUS_AT_DISCHARGE_VALUES),
];
exports.saveDischargeDetailsValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
    (0, express_validator_1.body)("discharge_type")
        .notEmpty()
        .withMessage("Discharge type is required")
        .bail()
        .isString()
        .isLength({ max: 100 }),
    (0, express_validator_1.body)("discharge_summary").optional({ values: "falsy" }).isString(),
    (0, express_validator_1.body)("discharge_advice").optional({ values: "falsy" }).isString(),
    (0, express_validator_1.body)("review_date").optional({ values: "falsy" }).isISO8601(),
    (0, express_validator_1.body)("discharge_disease_status").optional({ values: "falsy" }).isString(),
    (0, express_validator_1.body)("patient_status_at_discharge")
        .optional({ values: "falsy" })
        .isIn(ipd_constants_1.PATIENT_STATUS_AT_DISCHARGE_VALUES),
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
exports.admitAdmissionValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
    (0, express_validator_1.body)("ward_id").optional().isString(),
    (0, express_validator_1.body)("bed_id").optional().isString(),
];
// Reserve takes the same optional ward/bed override as admit.
exports.reserveBedValidation = exports.admitAdmissionValidation;
// Cancel / no-show of a planned admission, with an optional reason.
exports.closePlannedValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Admission ID or IP number is required"),
    (0, express_validator_1.body)("reason")
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage("Reason must be at most 500 characters"),
];
// Daycare booking: doctor slot + PLANNED daycare admission (ward required,
// bed optional, session length more than 0 and at most 1 day).
exports.createDaycareValidation = [
    (0, express_validator_1.body)("patient_id").notEmpty().withMessage("Patient is required"),
    (0, express_validator_1.body)("branch_id").notEmpty().withMessage("Branch is required"),
    (0, express_validator_1.body)("department_id").notEmpty().withMessage("Department is required"),
    (0, express_validator_1.body)("employee_id").notEmpty().withMessage("Doctor is required"),
    (0, express_validator_1.body)("ward_id").notEmpty().withMessage("Ward is required for a daycare booking"),
    (0, express_validator_1.body)("bed_id").optional().isString(),
    (0, express_validator_1.body)("appointment_date")
        .notEmpty().withMessage("Date is required")
        .isISO8601().withMessage("Date must be a valid date"),
    (0, express_validator_1.body)("appointment_time")
        .notEmpty().withMessage("Time slot is required")
        .matches(/^\d{1,2}:\d{2}(:\d{2})?$/).withMessage("Time slot must be HH:mm"),
    (0, express_validator_1.body)("expected_stay_days")
        .isFloat({ gt: 0, max: 1 })
        .withMessage("Daycare duration must be more than 0 and at most 24 hours"),
    (0, express_validator_1.body)("payment_mode").optional().isString(),
    (0, express_validator_1.body)("advance_amount").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("provisional_diagnosis").optional().isString(),
    (0, express_validator_1.body)("reason_for_visit").optional().isString(),
];
exports.daycareOccupancyValidation = [
    (0, express_validator_1.query)("wardId").notEmpty().withMessage("Ward is required"),
    (0, express_validator_1.query)("date").isISO8601().withMessage("Date must be a valid date (yyyy-MM-dd)"),
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
    // Only admissions the caller is the consultant / duty doctor / nurse of.
    (0, express_validator_1.query)("assignedToMe").optional().isBoolean(),
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
exports.updateWardValidation = [
    (0, express_validator_1.param)("wardId")
        .notEmpty()
        .withMessage("Ward ID is required"),
    (0, express_validator_1.body)("ward_name").optional().trim().notEmpty().withMessage("Ward name cannot be empty"),
    (0, express_validator_1.body)("ward_type").optional().trim().isString(),
    (0, express_validator_1.body)("floor").optional().trim().isString(),
    (0, express_validator_1.body)("tariff").optional().isNumeric().withMessage("Tariff must be a valid number"),
    (0, express_validator_1.body)("active_status").optional().isInt({ min: 0, max: 1 }).withMessage("Active status must be 0 or 1"),
];
exports.updateBedValidation = [
    (0, express_validator_1.param)("bedId")
        .notEmpty()
        .withMessage("Bed ID is required"),
    (0, express_validator_1.body)("bed_number").optional().trim().notEmpty().withMessage("Bed number cannot be empty"),
    (0, express_validator_1.body)("bed_type").optional().trim().isString(),
    (0, express_validator_1.body)("tariff").optional().isNumeric().withMessage("Tariff must be a valid number"),
    (0, express_validator_1.body)("ward_id").optional().trim().isString(),
    (0, express_validator_1.body)("active_status").optional().isInt({ min: 0, max: 1 }).withMessage("Active status must be 0 or 1"),
];
exports.updateBedStatusValidation = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("Bed ID is required"),
    (0, express_validator_1.body)("status")
        .notEmpty()
        .withMessage("Status is required")
        .isIn([...ipd_constants_2.MANUAL_BED_STATUSES])
        .withMessage(`Status must be one of: ${ipd_constants_2.MANUAL_BED_STATUSES.join(", ")}`),
    (0, express_validator_1.body)("remarks").optional().trim().isString(),
];
exports.addDischargeTypeValidation = [
    (0, express_validator_1.body)("type_name")
        .trim()
        .notEmpty()
        .withMessage("Discharge type is required")
        .bail()
        .isLength({ max: 100 })
        .withMessage("Discharge type must be at most 100 characters"),
];
