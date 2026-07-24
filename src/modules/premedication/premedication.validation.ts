import { body } from "express-validator";

export const createPremedicationValidation = [

    body("premed_code")
        .notEmpty()
        .withMessage("Premedication code is required")
        .isLength({ max: 30 }),

    body("premed_name")
        .notEmpty()
        .withMessage("Premedication name is required")
        .isLength({ max: 200 }),

    body("premed_category")
        .optional()
        .isIn(["Antiemetic", "Antihistamine", "Steroid", "H2 Blocker", "Other"])
        .withMessage(
            "premed_category must be one of Antiemetic, Antihistamine, Steroid, H2 Blocker, Other"
        ),

    body("standard_dose")
        .optional()
        .isString(),

    body("route")
        .optional()
        .isString(),

    body("timing_before_chemo_minutes")
        .optional()
        .isInt({ min: 0 })
        .withMessage("timing_before_chemo_minutes must be a positive integer"),

    body("linked_medicine_id")
        .optional()
        .isString()

];

export const updatePremedicationValidation = [

    body("premed_name")
        .optional()
        .isLength({ max: 200 }),

    body("timing_before_chemo_minutes")
        .optional()
        .isInt({ min: 0 }),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
