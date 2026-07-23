"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppointmentsValidation = exports.getAvailableSlotsValidation = exports.updateAppointmentStatusValidation = exports.updateAppointmentValidation = exports.createAppointmentValidation = void 0;
const express_validator_1 = require("express-validator");
const appointment_constants_1 = require("./appointment.constants");
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
exports.createAppointmentValidation = [
    (0, express_validator_1.body)("patient_id")
        .notEmpty()
        .withMessage("Patient is required"),
    (0, express_validator_1.body)("employee_id")
        .notEmpty()
        .withMessage("Doctor is required"),
    (0, express_validator_1.body)("branch_id")
        .notEmpty()
        .withMessage("Branch is required"),
    (0, express_validator_1.body)("department_id")
        .optional()
        .notEmpty(),
    (0, express_validator_1.body)("appointment_date")
        .notEmpty()
        .withMessage("Appointment date is required")
        .isISO8601()
        .withMessage("Appointment date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("appointment_time")
        .notEmpty()
        .withMessage("Appointment time is required")
        .matches(TIME_PATTERN)
        .withMessage("Appointment time must be in HH:mm format"),
    (0, express_validator_1.body)("reason_for_visit")
        .optional()
        .isString(),
    (0, express_validator_1.body)("referred_by")
        .optional()
        .isString(),
    (0, express_validator_1.body)("booking_source")
        .optional()
        .isString()
];
exports.updateAppointmentValidation = [
    (0, express_validator_1.param)("appointmentNo")
        .notEmpty(),
    (0, express_validator_1.body)("employee_id")
        .optional()
        .notEmpty(),
    (0, express_validator_1.body)("branch_id")
        .optional()
        .notEmpty(),
    (0, express_validator_1.body)("department_id")
        .optional()
        .notEmpty(),
    (0, express_validator_1.body)("appointment_date")
        .optional()
        .isISO8601()
        .withMessage("Appointment date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("appointment_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("Appointment time must be in HH:mm format"),
    (0, express_validator_1.body)("reason_for_visit")
        .optional()
        .isString(),
    (0, express_validator_1.body)("referred_by")
        .optional()
        .isString()
];
exports.updateAppointmentStatusValidation = [
    (0, express_validator_1.param)("appointmentNo")
        .notEmpty(),
    (0, express_validator_1.body)("status")
        .notEmpty()
        .withMessage("Status is required")
        .isIn(appointment_constants_1.APPOINTMENT_STATUS_VALUES)
        .withMessage(`Status must be one of: ${appointment_constants_1.APPOINTMENT_STATUS_VALUES.join(", ")}`)
];
exports.getAvailableSlotsValidation = [
    (0, express_validator_1.query)("employeeId")
        .notEmpty()
        .withMessage("Doctor is required"),
    (0, express_validator_1.query)("branchId")
        .notEmpty()
        .withMessage("Branch is required"),
    (0, express_validator_1.query)("date")
        .notEmpty()
        .withMessage("Date is required")
        .isISO8601()
        .withMessage("Date must be a valid date (YYYY-MM-DD)")
];
exports.getAppointmentsValidation = [
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 }),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)("status")
        .optional()
        .isIn(appointment_constants_1.APPOINTMENT_STATUS_VALUES),
    (0, express_validator_1.query)("date")
        .optional()
        .isISO8601(),
    (0, express_validator_1.query)("dateFrom")
        .optional()
        .isISO8601(),
    (0, express_validator_1.query)("dateTo")
        .optional()
        .isISO8601()
];
