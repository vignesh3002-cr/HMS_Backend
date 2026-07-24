import { body } from "express-validator";

export const createHydrationValidation = [

    body("hydration_code")
        .notEmpty()
        .withMessage("Hydration code is required")
        .isLength({ max: 30 }),

    body("fluid_name")
        .notEmpty()
        .withMessage("Fluid name is required (e.g. Normal Saline 0.9%)")
        .isLength({ max: 200 }),

    body("fluid_type")
        .optional()
        .isString(),

    body("standard_volume_ml")
        .optional()
        .isInt({ min: 0 })
        .withMessage("standard_volume_ml must be a positive integer"),

    body("infusion_rate")
        .optional()
        .isString(),

    body("timing")
        .optional()
        .isIn(["Pre-hydration", "Post-hydration", "Concurrent"])
        .withMessage("timing must be one of Pre-hydration, Post-hydration, Concurrent"),

    body("indication")
        .optional()
        .isString(),

    body("linked_medicine_id")
        .optional()
        .isString()

];

export const updateHydrationValidation = [

    body("fluid_name")
        .optional()
        .isLength({ max: 200 }),

    body("standard_volume_ml")
        .optional()
        .isInt({ min: 0 }),

    body("timing")
        .optional()
        .isIn(["Pre-hydration", "Post-hydration", "Concurrent"])
        .withMessage("timing must be one of Pre-hydration, Post-hydration, Concurrent"),

    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("is_active must be a boolean")

];
