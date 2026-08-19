import { body, param, query } from "express-validator";
import { DAY_OF_WEEK_NAMES } from "../appointment/appointment.constants";
import {
    TRANSFER_ACTION_VALUES,
    RESCHEDULE_ACTION_INPUT_VALUES,
    NOTIFICATION_CHANNEL_VALUES
} from "./doctorTransfer.constants";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const initiateTransferValidation = [

    param("employeeId")
        .notEmpty(),

    body("mode")
        .notEmpty()
        .withMessage("mode is required")
        .isIn(["TRANSFER", "ADD_BRANCH"])
        .withMessage("mode must be one of: TRANSFER, ADD_BRANCH"),

    body("old_branch_id")
        .if(body("mode").equals("TRANSFER"))
        .notEmpty()
        .withMessage("From branch (old_branch_id) is required for a transfer"),

    body("close_schedule_ids")
        .optional()
        .isArray({ min: 1 })
        .withMessage("close_schedule_ids must be a non-empty array of schedule ids"),

    body("close_schedule_ids.*")
        .optional()
        .isInt({ min: 1 })
        .withMessage("close_schedule_ids entries must be valid schedule ids"),

    body("new_branch_id")
        .notEmpty()
        .withMessage("New branch is required"),

    body("new_department_id")
        .optional()
        .notEmpty(),

    body("effective_date")
        .notEmpty()
        .withMessage("Effective date is required")
        .isISO8601()
        .withMessage("Effective date must be a valid date (YYYY-MM-DD)"),

    body("transfer_reason")
        .notEmpty()
        .withMessage("Transfer reason is required"),

    body("working_hours")
        .isArray({ min: 1 })
        .withMessage("At least one working hour entry is required"),

    body("working_hours.*.branch_id")
        .notEmpty()
        .withMessage("Each working hour entry requires a branch_id"),

    body("working_hours.*.day_of_week")
        .isIn(DAY_OF_WEEK_NAMES)
        .withMessage(`day_of_week must be one of: ${DAY_OF_WEEK_NAMES.join(", ")}`),

    body("working_hours.*.start_time")
        .matches(TIME_PATTERN)
        .withMessage("start_time must be in HH:mm format"),

    body("working_hours.*.end_time")
        .matches(TIME_PATTERN)
        .withMessage("end_time must be in HH:mm format"),

    body("consultation_minutes")
        .optional()
        .isInt({ min: 1 })

];

export const confirmTransferValidation = [

    param("employeeId")
        .notEmpty(),

    body("transfer_id")
        .notEmpty()
        .withMessage("transfer_id is required"),

    body("action")
        .notEmpty()
        .isIn(TRANSFER_ACTION_VALUES)
        .withMessage(`action must be one of: ${TRANSFER_ACTION_VALUES.join(", ")}`),

    body("old_branch_id")
        .optional()
        .notEmpty(),

    body("replacement_employee_id")
        .if(body("action").equals("TRANSFER"))
        .notEmpty()
        .withMessage("replacement_employee_id is required for the TRANSFER action"),

    body("confirm")
        .if(body("action").equals("CANCEL"))
        .custom((value) => value === true)
        .withMessage("confirm must be true to bulk-cancel appointments"),

    body("notify_channels")
        .optional()
        .isArray(),

    body("notify_channels.*")
        .optional()
        .isIn(NOTIFICATION_CHANNEL_VALUES)

];

export const getFutureAppointmentsValidation = [

    param("employeeId")
        .notEmpty(),

    query("effective_date")
        .optional()
        .isISO8601()
        .withMessage("effective_date must be a valid date (YYYY-MM-DD)")

];

export const transferPreviewValidation = [

    body("employee_id")
        .notEmpty()
        .withMessage("employee_id is required"),

    body("effective_date")
        .optional()
        .isISO8601()
        .withMessage("effective_date must be a valid date (YYYY-MM-DD)")

];

export const getRescheduleQueueValidation = [

    query("page")
        .optional()
        .isInt({ min: 1 }),

    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })

];

export const processRescheduleActionValidation = [

    param("appointmentId")
        .notEmpty(),

    body("action")
        .notEmpty()
        .isIn(RESCHEDULE_ACTION_INPUT_VALUES)
        .withMessage(`action must be one of: ${RESCHEDULE_ACTION_INPUT_VALUES.join(", ")}`),

    body("employee_id")
        .if(body("action").equals("ASSIGN"))
        .notEmpty()
        .withMessage("employee_id is required to assign a slot"),

    body("branch_id")
        .if(body("action").equals("ASSIGN"))
        .notEmpty()
        .withMessage("branch_id is required to assign a slot"),

    body("appointment_date")
        .if(body("action").equals("ASSIGN"))
        .notEmpty()
        .isISO8601()
        .withMessage("appointment_date must be a valid date (YYYY-MM-DD)"),

    body("appointment_time")
        .if(body("action").equals("ASSIGN"))
        .notEmpty()
        .matches(TIME_PATTERN)
        .withMessage("appointment_time must be in HH:mm format")

];
