import { body, param, query } from "express-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createScheduleChangeValidation = [
    body("employee_id")
        .notEmpty()
        .withMessage("Employee ID is required"),

    body("branch_id")
        .notEmpty()
        .withMessage("Branch ID is required"),

    body("change_date")
        .notEmpty()
        .withMessage("Change date is required")
        .isISO8601()
        .withMessage("Change date must be a valid date (YYYY-MM-DD)"),

    body("mode")
        .notEmpty()
        .isIn(["ADD", "OVERRIDE", "CANCEL"])
        .withMessage("Mode must be one of: ADD, OVERRIDE, CANCEL"),

    body("start_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("Start time must be in HH:mm format"),

    body("end_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("End time must be in HH:mm format"),

    body("reason")
        .optional()
        .isString(),
];

export const updateScheduleChangeValidation = [
    param("changeId")
        .notEmpty()
        .withMessage("Change ID is required"),

    body("mode")
        .optional()
        .isIn(["ADD", "OVERRIDE", "CANCEL"])
        .withMessage("Mode must be one of: ADD, OVERRIDE, CANCEL"),

    body("start_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("Start time must be in HH:mm format"),

    body("end_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("End time must be in HH:mm format"),

    body("reason")
        .optional()
        .isString(),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean"),
];

export const cancelScheduleChangeValidation = [
    param("changeId")
        .notEmpty()
        .withMessage("Change ID is required"),
];

export const createRecurringSlotValidation = [
    body("employee_id")
        .notEmpty()
        .withMessage("Employee ID is required"),

    body("branch_id")
        .notEmpty()
        .withMessage("Branch ID is required"),

    body("day_of_week")
        .notEmpty()
        .withMessage("Day of week is required"),

    body("start_time")
        .notEmpty()
        .withMessage("Start time is required")
        .matches(TIME_PATTERN)
        .withMessage("Start time must be in HH:mm format"),

    body("end_time")
        .notEmpty()
        .withMessage("End time is required")
        .matches(TIME_PATTERN)
        .withMessage("End time must be in HH:mm format"),

    body("shift_name")
        .optional()
        .isString(),
];

export const updateRecurringSlotValidation = [
    param("employeeId")
        .notEmpty()
        .withMessage("Employee ID is required"),

    param("scheduleId")
        .notEmpty()
        .withMessage("Schedule ID is required"),

    body("branch_id")
        .optional()
        .notEmpty()
        .withMessage("Branch ID is required"),

    body("day_of_week")
        .optional()
        .notEmpty()
        .withMessage("Day of week is required"),

    body("shift_name")
        .optional()
        .isString(),

    body("start_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("Start time must be in HH:mm format"),

    body("end_time")
        .optional()
        .matches(TIME_PATTERN)
        .withMessage("End time must be in HH:mm format"),
];

export const toggleRecurringDayValidation = [
    body("employee_id")
        .notEmpty()
        .withMessage("Employee ID is required"),

    body("branch_id")
        .notEmpty()
        .withMessage("Branch ID is required"),

    body("day_of_week")
        .notEmpty()
        .withMessage("Day of week is required"),

    body("is_active")
        .notEmpty()
        .isBoolean()
        .withMessage("is_active must be a boolean"),
];

export const getDoctorScheduleChangesValidation = [
    query("employeeId")
        .notEmpty()
        .withMessage("Doctor ID is required"),

    query("branchId")
        .optional(),
];

export const getScheduleChangesByDateValidation = [
    query("employeeId")
        .notEmpty()
        .withMessage("Doctor ID is required"),

    query("date")
        .notEmpty()
        .withMessage("Date is required")
        .isISO8601()
        .withMessage("Date must be a valid date (YYYY-MM-DD)"),
];