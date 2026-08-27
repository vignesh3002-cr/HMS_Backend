"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScheduleChangesByDateValidation = exports.getDoctorScheduleChangesValidation = exports.toggleRecurringDayValidation = exports.updateRecurringSlotValidation = exports.createRecurringSlotValidation = exports.cancelScheduleChangeValidation = exports.updateScheduleChangeValidation = exports.createScheduleChangeValidation = void 0;
const express_validator_1 = require("express-validator");
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
exports.createScheduleChangeValidation = [
    (0, express_validator_1.body)("employee_id")
        .notEmpty()
        .withMessage("Employee ID is required"),
    (0, express_validator_1.body)("branch_id")
        .notEmpty()
        .withMessage("Branch ID is required"),
    (0, express_validator_1.body)("change_date")
        .notEmpty()
        .withMessage("Change date is required")
        .isISO8601()
        .withMessage("Change date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("mode")
        .notEmpty()
        .isIn(["ADD", "OVERRIDE", "CANCEL"])
        .withMessage("Mode must be one of: ADD, OVERRIDE, CANCEL"),
    (0, express_validator_1.body)("start_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("Start time must be in HH:mm format"),
    (0, express_validator_1.body)("end_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("End time must be in HH:mm format"),
    (0, express_validator_1.body)("reason")
        .optional()
        .isString(),
];
exports.updateScheduleChangeValidation = [
    (0, express_validator_1.param)("changeId")
        .notEmpty()
        .withMessage("Change ID is required"),
    (0, express_validator_1.body)("mode")
        .optional()
        .isIn(["ADD", "OVERRIDE", "CANCEL"])
        .withMessage("Mode must be one of: ADD, OVERRIDE, CANCEL"),
    (0, express_validator_1.body)("start_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("Start time must be in HH:mm format"),
    (0, express_validator_1.body)("end_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("End time must be in HH:mm format"),
    (0, express_validator_1.body)("reason")
        .optional()
        .isString(),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean"),
];
exports.cancelScheduleChangeValidation = [
    (0, express_validator_1.param)("changeId")
        .notEmpty()
        .withMessage("Change ID is required"),
];
exports.createRecurringSlotValidation = [
    (0, express_validator_1.body)("employee_id")
        .notEmpty()
        .withMessage("Employee ID is required"),
    (0, express_validator_1.body)("branch_id")
        .notEmpty()
        .withMessage("Branch ID is required"),
    (0, express_validator_1.body)("day_of_week")
        .notEmpty()
        .withMessage("Day of week is required"),
    (0, express_validator_1.body)("start_time")
        .notEmpty()
        .withMessage("Start time is required")
        .matches(TIME_PATTERN)
        .withMessage("Start time must be in HH:mm format"),
    (0, express_validator_1.body)("end_time")
        .notEmpty()
        .withMessage("End time is required")
        .matches(TIME_PATTERN)
        .withMessage("End time must be in HH:mm format"),
    (0, express_validator_1.body)("shift_name")
        .optional()
        .isString(),
];
exports.updateRecurringSlotValidation = [
    (0, express_validator_1.param)("employeeId")
        .notEmpty()
        .withMessage("Employee ID is required"),
    (0, express_validator_1.param)("scheduleId")
        .notEmpty()
        .withMessage("Schedule ID is required"),
    (0, express_validator_1.body)("branch_id")
        .optional()
        .notEmpty()
        .withMessage("Branch ID is required"),
    (0, express_validator_1.body)("day_of_week")
        .optional()
        .notEmpty()
        .withMessage("Day of week is required"),
    (0, express_validator_1.body)("shift_name")
        .optional()
        .isString(),
    (0, express_validator_1.body)("start_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("Start time must be in HH:mm format"),
    (0, express_validator_1.body)("end_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("End time must be in HH:mm format"),
];
exports.toggleRecurringDayValidation = [
    (0, express_validator_1.body)("employee_id")
        .notEmpty()
        .withMessage("Employee ID is required"),
    (0, express_validator_1.body)("branch_id")
        .notEmpty()
        .withMessage("Branch ID is required"),
    (0, express_validator_1.body)("day_of_week")
        .notEmpty()
        .withMessage("Day of week is required"),
    (0, express_validator_1.body)("is_active")
        .notEmpty()
        .isBoolean()
        .withMessage("is_active must be a boolean"),
];
exports.getDoctorScheduleChangesValidation = [
    (0, express_validator_1.query)("employeeId")
        .notEmpty()
        .withMessage("Doctor ID is required"),
    (0, express_validator_1.query)("branchId")
        .optional(),
];
exports.getScheduleChangesByDateValidation = [
    (0, express_validator_1.query)("employeeId")
        .notEmpty()
        .withMessage("Doctor ID is required"),
    (0, express_validator_1.query)("date")
        .notEmpty()
        .withMessage("Date is required")
        .isISO8601()
        .withMessage("Date must be a valid date (YYYY-MM-DD)"),
];
