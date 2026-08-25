import { body } from "express-validator";

export const createLabOrderValidation = [

    body("patient_history_id")
        .optional()
        .notEmpty()
        .withMessage("Patient History ID cannot be empty"),

    body("patient_id")
        .optional()
        .notEmpty()
        .withMessage("Patient ID cannot be empty"),

    body("doctor_employee_id")
        .notEmpty()
        .withMessage("Doctor Employee ID is required"),

    body("appointment_id")
        .optional()
        .notEmpty()
        .withMessage("Appointment ID cannot be empty"),

    body("department_id")
        .optional()
        .notEmpty()
        .withMessage("Department ID cannot be empty"),

    body("priority")
        .optional()
        .isIn(["Normal", "Urgent", "Stat"])
        .withMessage("Priority must be Normal, Urgent or Stat"),

    body("clinical_notes")
        .optional()
        .isString(),

    body("provisional_diagnosis")
        .optional()
        .isString()

];

export const updateLabOrderValidation = [

    body("priority")
        .optional()
        .isIn(["Normal", "Urgent", "Stat"])
        .withMessage("Priority must be Normal, Urgent or Stat"),

    body("clinical_notes")
        .optional()
        .isString(),

    body("provisional_diagnosis")
        .optional()
        .isString(),

    body("order_status")
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