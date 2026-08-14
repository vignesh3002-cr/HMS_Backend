import { body, param, query } from "express-validator";
import {
    LEAVE_STATUS_VALUES,
    LEAVE_REASON_MAX_LENGTH,
    LEAVE_REMARKS_MAX_LENGTH
} from "./doctorLeave.constants";

export const applyDoctorLeaveValidation = [

    param("employeeId")
        .notEmpty()
        .withMessage("employeeId is required"),

    body("leave_start_date")
        .notEmpty()
        .withMessage("Leave start date is required")
        .isISO8601()
        .withMessage("leave_start_date must be a valid date (YYYY-MM-DD)"),

    body("leave_end_date")
        .notEmpty()
        .withMessage("Leave end date is required")
        .isISO8601()
        .withMessage("leave_end_date must be a valid date (YYYY-MM-DD)"),

    body("leave_reason")
        .notEmpty()
        .withMessage("Leave reason is required")
        .isLength({ max: LEAVE_REASON_MAX_LENGTH })
        .withMessage(
            `Leave reason cannot exceed ${LEAVE_REASON_MAX_LENGTH} characters`
        ),

    body("replacement_employee_id")
        .optional()
        .notEmpty()
        .withMessage("replacement_employee_id cannot be empty")

];

export const approveDoctorLeaveValidation = [

    param("leaveId")
        .notEmpty()
        .withMessage("leaveId is required"),

    body("remarks")
        .optional()
        .isLength({ max: LEAVE_REMARKS_MAX_LENGTH })
        .withMessage(
            `Remarks cannot exceed ${LEAVE_REMARKS_MAX_LENGTH} characters`
        )

];

export const rejectDoctorLeaveValidation = [

    param("leaveId")
        .notEmpty()
        .withMessage("leaveId is required"),

    body("remarks")
        .notEmpty()
        .withMessage("Remarks are required")
        .isLength({ max: LEAVE_REMARKS_MAX_LENGTH })
        .withMessage(
            `Remarks cannot exceed ${LEAVE_REMARKS_MAX_LENGTH} characters`
        )

];

export const getDoctorLeaveValidation = [

    query("employee_id")
        .optional(),

    query("status")
        .optional()
        .isIn(LEAVE_STATUS_VALUES)
        .withMessage(
            `status must be one of: ${LEAVE_STATUS_VALUES.join(", ")}`
        ),

    query("page")
        .optional()
        .isInt({ min: 1 }),

    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })

];