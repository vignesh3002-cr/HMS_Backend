"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTreatmentPlanValidation = exports.createTreatmentPlanValidation = void 0;
const express_validator_1 = require("express-validator");
const PLAN_STATUSES = [
    "Draft",
    "Pending Approval",
    "Approved",
    "Active",
    "Completed",
    "Cancelled",
    "On-Hold"
];
exports.createTreatmentPlanValidation = [
    (0, express_validator_1.body)("diagnosis_id")
        .notEmpty()
        .withMessage("diagnosis_id is required"),
    (0, express_validator_1.body)("patient_id")
        .notEmpty()
        .withMessage("patient_id is required"),
    (0, express_validator_1.body)("protocol_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("treatment_intent_id")
        .optional()
        .isString(),
    (0, express_validator_1.body)("height_cm")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("height_cm must be a positive number"),
    (0, express_validator_1.body)("weight_kg")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("weight_kg must be a positive number"),
    (0, express_validator_1.body)("body_surface_area")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("body_surface_area must be a positive number"),
    (0, express_validator_1.body)("ecog_performance_status")
        .optional()
        .isIn(["0", "1", "2", "3", "4"])
        .withMessage("ecog_performance_status must be between 0 and 4"),
    (0, express_validator_1.body)("planned_total_cycles")
        .optional()
        .isInt({ min: 1 })
        .withMessage("planned_total_cycles must be a positive integer"),
    (0, express_validator_1.body)("cycle_interval_days")
        .optional()
        .isInt({ min: 1 })
        .withMessage("cycle_interval_days must be a positive integer"),
    (0, express_validator_1.body)("planned_start_date")
        .optional()
        .isISO8601()
        .withMessage("planned_start_date must be a valid date"),
    (0, express_validator_1.body)("clinical_summary")
        .optional()
        .isString(),
    (0, express_validator_1.body)("remarks")
        .optional()
        .isString()
];
exports.updateTreatmentPlanValidation = [
    (0, express_validator_1.body)("height_cm")
        .optional()
        .isFloat({ min: 0 }),
    (0, express_validator_1.body)("weight_kg")
        .optional()
        .isFloat({ min: 0 }),
    (0, express_validator_1.body)("body_surface_area")
        .optional()
        .isFloat({ min: 0 }),
    (0, express_validator_1.body)("ecog_performance_status")
        .optional()
        .isIn(["0", "1", "2", "3", "4"]),
    (0, express_validator_1.body)("planned_total_cycles")
        .optional()
        .isInt({ min: 1 }),
    (0, express_validator_1.body)("cycle_interval_days")
        .optional()
        .isInt({ min: 1 }),
    (0, express_validator_1.body)("planned_start_date")
        .optional()
        .isISO8601(),
    (0, express_validator_1.body)("plan_status")
        .optional()
        .isIn(PLAN_STATUSES)
        .withMessage(`plan_status must be one of ${PLAN_STATUSES.join(", ")}`),
    (0, express_validator_1.body)("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")
];
