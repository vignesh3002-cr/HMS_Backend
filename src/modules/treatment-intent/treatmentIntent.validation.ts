import { body } from "express-validator";

export const createTreatmentIntentValidation = [

    body("intent_code")
        .notEmpty()
        .withMessage("Intent code is required")
        .isLength({ max: 20 })
        .withMessage("Intent code must not exceed 20 characters"),

    body("intent_name")
        .notEmpty()
        .withMessage("Intent name is required")
        .isIn(["Curative", "Palliative", "Neoadjuvant", "Adjuvant", "Maintenance"])
        .withMessage(
            "Intent name must be one of Curative, Palliative, Neoadjuvant, Adjuvant, Maintenance"
        ),

    body("description")
        .optional()
        .isString()

];

export const updateTreatmentIntentValidation = [

    body("intent_name")
        .optional()
        .isIn(["Curative", "Palliative", "Neoadjuvant", "Adjuvant", "Maintenance"])
        .withMessage(
            "Intent name must be one of Curative, Palliative, Neoadjuvant, Adjuvant, Maintenance"
        ),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
