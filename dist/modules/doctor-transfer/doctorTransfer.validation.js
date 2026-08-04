"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRescheduleActionValidation = exports.getRescheduleQueueValidation = exports.transferPreviewValidation = exports.getFutureAppointmentsValidation = exports.confirmTransferValidation = exports.initiateTransferValidation = void 0;
const express_validator_1 = require("express-validator");
const appointment_constants_1 = require("../appointment/appointment.constants");
const doctorTransfer_constants_1 = require("./doctorTransfer.constants");
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
exports.initiateTransferValidation = [
    (0, express_validator_1.param)("employeeId")
        .notEmpty(),
    (0, express_validator_1.body)("new_branch_id")
        .notEmpty()
        .withMessage("New branch is required"),
    (0, express_validator_1.body)("new_department_id")
        .optional()
        .notEmpty(),
    (0, express_validator_1.body)("effective_date")
        .notEmpty()
        .withMessage("Effective date is required")
        .isISO8601()
        .withMessage("Effective date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("transfer_reason")
        .notEmpty()
        .withMessage("Transfer reason is required"),
    (0, express_validator_1.body)("working_hours")
        .isArray({ min: 1 })
        .withMessage("At least one working hour entry is required"),
    (0, express_validator_1.body)("working_hours.*.branch_id")
        .notEmpty()
        .withMessage("Each working hour entry requires a branch_id"),
    (0, express_validator_1.body)("working_hours.*.day_of_week")
        .isIn(appointment_constants_1.DAY_OF_WEEK_NAMES)
        .withMessage(`day_of_week must be one of: ${appointment_constants_1.DAY_OF_WEEK_NAMES.join(", ")}`),
    (0, express_validator_1.body)("working_hours.*.start_time")
        .matches(TIME_PATTERN)
        .withMessage("start_time must be in HH:mm format"),
    (0, express_validator_1.body)("working_hours.*.end_time")
        .matches(TIME_PATTERN)
        .withMessage("end_time must be in HH:mm format"),
    (0, express_validator_1.body)("consultation_minutes")
        .optional()
        .isInt({ min: 1 })
];
exports.confirmTransferValidation = [
    (0, express_validator_1.param)("employeeId")
        .notEmpty(),
    (0, express_validator_1.body)("transfer_id")
        .notEmpty()
        .withMessage("transfer_id is required"),
    (0, express_validator_1.body)("action")
        .notEmpty()
        .isIn(doctorTransfer_constants_1.TRANSFER_ACTION_VALUES)
        .withMessage(`action must be one of: ${doctorTransfer_constants_1.TRANSFER_ACTION_VALUES.join(", ")}`),
    (0, express_validator_1.body)("replacement_employee_id")
        .if((0, express_validator_1.body)("action").equals("TRANSFER"))
        .notEmpty()
        .withMessage("replacement_employee_id is required for the TRANSFER action"),
    (0, express_validator_1.body)("confirm")
        .if((0, express_validator_1.body)("action").equals("CANCEL"))
        .custom((value) => value === true)
        .withMessage("confirm must be true to bulk-cancel appointments"),
    (0, express_validator_1.body)("notify_channels")
        .optional()
        .isArray(),
    (0, express_validator_1.body)("notify_channels.*")
        .optional()
        .isIn(doctorTransfer_constants_1.NOTIFICATION_CHANNEL_VALUES)
];
exports.getFutureAppointmentsValidation = [
    (0, express_validator_1.param)("employeeId")
        .notEmpty(),
    (0, express_validator_1.query)("effective_date")
        .optional()
        .isISO8601()
        .withMessage("effective_date must be a valid date (YYYY-MM-DD)")
];
exports.transferPreviewValidation = [
    (0, express_validator_1.body)("employee_id")
        .notEmpty()
        .withMessage("employee_id is required"),
    (0, express_validator_1.body)("effective_date")
        .optional()
        .isISO8601()
        .withMessage("effective_date must be a valid date (YYYY-MM-DD)")
];
exports.getRescheduleQueueValidation = [
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 }),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
];
exports.processRescheduleActionValidation = [
    (0, express_validator_1.param)("appointmentId")
        .notEmpty(),
    (0, express_validator_1.body)("action")
        .notEmpty()
        .isIn(doctorTransfer_constants_1.RESCHEDULE_ACTION_INPUT_VALUES)
        .withMessage(`action must be one of: ${doctorTransfer_constants_1.RESCHEDULE_ACTION_INPUT_VALUES.join(", ")}`),
    (0, express_validator_1.body)("employee_id")
        .if((0, express_validator_1.body)("action").equals("ASSIGN"))
        .notEmpty()
        .withMessage("employee_id is required to assign a slot"),
    (0, express_validator_1.body)("branch_id")
        .if((0, express_validator_1.body)("action").equals("ASSIGN"))
        .notEmpty()
        .withMessage("branch_id is required to assign a slot"),
    (0, express_validator_1.body)("appointment_date")
        .if((0, express_validator_1.body)("action").equals("ASSIGN"))
        .notEmpty()
        .isISO8601()
        .withMessage("appointment_date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("appointment_time")
        .if((0, express_validator_1.body)("action").equals("ASSIGN"))
        .notEmpty()
        .matches(TIME_PATTERN)
        .withMessage("appointment_time must be in HH:mm format")
];
