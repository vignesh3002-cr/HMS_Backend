"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLabOrderValidation = exports.createLabOrderValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createLabOrderValidation = [
    (0, express_validator_1.body)("patient_history_id")
        .optional()
        .notEmpty()
        .withMessage("Patient History ID cannot be empty"),
    (0, express_validator_1.body)("patient_id")
        .optional()
        .notEmpty()
        .withMessage("Patient ID cannot be empty"),
    (0, express_validator_1.body)("doctor_employee_id")
        .notEmpty()
        .withMessage("Doctor Employee ID is required"),
    (0, express_validator_1.body)("appointment_id")
        .optional()
        .notEmpty()
        .withMessage("Appointment ID cannot be empty"),
    (0, express_validator_1.body)("department_id")
        .optional()
        .notEmpty()
        .withMessage("Department ID cannot be empty"),
    (0, express_validator_1.body)("priority")
        .optional()
        .isIn(["Normal", "Urgent", "Stat"])
        .withMessage("Priority must be Normal, Urgent or Stat"),
    (0, express_validator_1.body)("clinical_notes")
        .optional()
        .isString(),
    (0, express_validator_1.body)("provisional_diagnosis")
        .optional()
        .isString()
];
exports.updateLabOrderValidation = [
    (0, express_validator_1.body)("priority")
        .optional()
        .isIn(["Normal", "Urgent", "Stat"])
        .withMessage("Priority must be Normal, Urgent or Stat"),
    (0, express_validator_1.body)("clinical_notes")
        .optional()
        .isString(),
    (0, express_validator_1.body)("provisional_diagnosis")
        .optional()
        .isString(),
    (0, express_validator_1.body)("order_status")
        .optional()
        .isIn([
        "Ordered",
        "Collected",
        "Processing",
        "Completed",
        "Cancelled"
    ])
        .withMessage("Invalid Order Status")
];
