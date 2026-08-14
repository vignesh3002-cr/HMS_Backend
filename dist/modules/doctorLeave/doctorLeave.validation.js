"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDoctorLeaveValidation = exports.rejectDoctorLeaveValidation = exports.approveDoctorLeaveValidation = exports.applyDoctorLeaveValidation = void 0;
const express_validator_1 = require("express-validator");
const doctorLeave_constants_1 = require("./doctorLeave.constants");
exports.applyDoctorLeaveValidation = [
    (0, express_validator_1.param)("employeeId")
        .notEmpty()
        .withMessage("employeeId is required"),
    (0, express_validator_1.body)("leave_start_date")
        .notEmpty()
        .withMessage("Leave start date is required")
        .isISO8601()
        .withMessage("leave_start_date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("leave_end_date")
        .notEmpty()
        .withMessage("Leave end date is required")
        .isISO8601()
        .withMessage("leave_end_date must be a valid date (YYYY-MM-DD)"),
    (0, express_validator_1.body)("leave_reason")
        .notEmpty()
        .withMessage("Leave reason is required")
        .isLength({ max: doctorLeave_constants_1.LEAVE_REASON_MAX_LENGTH })
        .withMessage(`Leave reason cannot exceed ${doctorLeave_constants_1.LEAVE_REASON_MAX_LENGTH} characters`),
    (0, express_validator_1.body)("replacement_employee_id")
        .optional()
        .notEmpty()
        .withMessage("replacement_employee_id cannot be empty")
];
exports.approveDoctorLeaveValidation = [
    (0, express_validator_1.param)("leaveId")
        .notEmpty()
        .withMessage("leaveId is required"),
    (0, express_validator_1.body)("remarks")
        .optional()
        .isLength({ max: doctorLeave_constants_1.LEAVE_REMARKS_MAX_LENGTH })
        .withMessage(`Remarks cannot exceed ${doctorLeave_constants_1.LEAVE_REMARKS_MAX_LENGTH} characters`)
];
exports.rejectDoctorLeaveValidation = [
    (0, express_validator_1.param)("leaveId")
        .notEmpty()
        .withMessage("leaveId is required"),
    (0, express_validator_1.body)("remarks")
        .notEmpty()
        .withMessage("Remarks are required")
        .isLength({ max: doctorLeave_constants_1.LEAVE_REMARKS_MAX_LENGTH })
        .withMessage(`Remarks cannot exceed ${doctorLeave_constants_1.LEAVE_REMARKS_MAX_LENGTH} characters`)
];
exports.getDoctorLeaveValidation = [
    (0, express_validator_1.query)("employee_id")
        .optional(),
    (0, express_validator_1.query)("status")
        .optional()
        .isIn(doctorLeave_constants_1.LEAVE_STATUS_VALUES)
        .withMessage(`status must be one of: ${doctorLeave_constants_1.LEAVE_STATUS_VALUES.join(", ")}`),
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 }),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
];
