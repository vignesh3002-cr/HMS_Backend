import { body } from "express-validator";

const PLAN_STATUSES = [
    "Draft",
    "Pending Approval",
    "Approved",
    "Active",
    "Completed",
    "Cancelled",
    "On-Hold"
];

export const createTreatmentPlanValidation = [

    body("diagnosis_id")
        .notEmpty()
        .withMessage("diagnosis_id is required"),

    body("patient_id")
        .notEmpty()
        .withMessage("patient_id is required"),

    body("protocol_id")
        .optional()
        .isString(),

    body("treatment_intent_id")
        .optional()
        .isString(),

    body("height_cm")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("height_cm must be a positive number"),

    body("weight_kg")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("weight_kg must be a positive number"),

    body("body_surface_area")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("body_surface_area must be a positive number"),

    body("ecog_performance_status")
        .optional()
        .isIn(["0", "1", "2", "3", "4"])
        .withMessage("ecog_performance_status must be between 0 and 4"),

    body("planned_total_cycles")
        .optional()
        .isInt({ min: 1 })
        .withMessage("planned_total_cycles must be a positive integer"),

    body("cycle_interval_days")
        .optional()
        .isInt({ min: 1 })
        .withMessage("cycle_interval_days must be a positive integer"),

    body("planned_start_date")
        .optional()
        .isISO8601()
        .withMessage("planned_start_date must be a valid date"),

    body("clinical_summary")
        .optional()
        .isString(),

    body("remarks")
        .optional()
        .isString()

];

export const updateTreatmentPlanValidation = [

    body("height_cm")
        .optional()
        .isFloat({ min: 0 }),

    body("weight_kg")
        .optional()
        .isFloat({ min: 0 }),

    body("body_surface_area")
        .optional()
        .isFloat({ min: 0 }),

    body("ecog_performance_status")
        .optional()
        .isIn(["0", "1", "2", "3", "4"]),

    body("planned_total_cycles")
        .optional()
        .isInt({ min: 1 }),

    body("cycle_interval_days")
        .optional()
        .isInt({ min: 1 }),

    body("planned_start_date")
        .optional()
        .isISO8601(),

    body("plan_status")
        .optional()
        .isIn(PLAN_STATUSES)
        .withMessage(`plan_status must be one of ${PLAN_STATUSES.join(", ")}`),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
