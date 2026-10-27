import { body, param, query } from "express-validator";

export const listMasterValidation = [

    query("search").optional().isString(),
    query("isActive").optional().isBoolean()

];

export const createCustomMasterValidation = [

    body("name")
        .notEmpty()
        .withMessage("name is required")
        .isString()
        .isLength({ max: 100 }),

    body("description").optional({ nullable: true }).isString()

];

export const getPersonalHistoryValidation = [

    param("encounterNo").notEmpty().withMessage("encounterNo is required")

];

export const upsertPersonalHistoryValidation = [

    param("encounterNo").notEmpty().withMessage("encounterNo is required"),
    body("immunization").optional({ nullable: true }).isArray(),
    body("immunization.*.code").optional().isString(),
    body("immunization.*.name").optional().isString(),
    body("immunization.*.others").optional({ nullable: true }).isString(),
    body("drug_consumption").optional({ nullable: true }).isArray(),
    body("drug_consumption.*.code").optional().isString(),
    body("drug_consumption.*.name").optional().isString(),
    body("drug_consumption.*.others").optional({ nullable: true }).isString(),
    body("drug_consumption.*.duration_value")
        .optional({ nullable: true })
        .isInt({ min: 0, max: 9999 })
        .withMessage("Duration value must be between 0 and 9999"),
    body("drug_consumption.*.duration_unit")
        .optional({ nullable: true })
        .isIn(["day", "week", "month", "year"])
        .withMessage("Duration unit must be day, week, month or year"),
    body("drug_consumption.*.commands")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 1000 })
        .withMessage("Command(s) must not exceed 1000 characters"),
    body("diet_type").optional({ nullable: true }).isString(),

    body("family_history").optional({ nullable: true }).isObject(),
    body("family_history.status")
        .optional()
        .isIn(["PRESENT", "NOT_PRESENT"])
        .withMessage("Family history status must be PRESENT or NOT_PRESENT"),
    body("family_history.entries").optional().isArray(),
    body("family_history.entries.*.degree")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 20 }),
    body("family_history.entries.*.relative_type")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 100 }),
    body("family_history.entries.*.condition")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 200 })
        .withMessage("Condition must not exceed 200 characters"),
    body("family_history.entries.*.age_at_diagnosis")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 20 }),
    body("family_history.entries.*.remarks")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 1000 })
        .withMessage("Remarks must not exceed 1000 characters")

];

export const addReportValidation = [

    param("encounterNo").notEmpty().withMessage("encounterNo is required"),
    body("lab_test_id").optional({ nullable: true }).isString(),
    body("test_name").optional({ nullable: true }).isString().isLength({ max: 200 }),
    body().custom((value) => {
        if (!value?.lab_test_id && !String(value?.test_name ?? "").trim()) {
            throw new Error("Select a lab test or type the test name");
        }
        return true;
    }),
    body("report_completed_date").optional({ nullable: true }).isISO8601(),
    body("result").optional({ nullable: true }).isString(),
    body("impression").optional({ nullable: true }).isString()

];

export const updateReportValidation = [

    param("encounterReportId").notEmpty().withMessage("encounterReportId is required"),
    body("lab_test_id").optional({ nullable: true }).isString(),
    body("test_name").optional({ nullable: true }).isString().isLength({ max: 200 }),
    body("report_completed_date").optional({ nullable: true }).isISO8601(),
    body("result").optional({ nullable: true }).isString(),
    body("impression").optional({ nullable: true }).isString()

];

export const addMolecularTestValidation = [

    param("encounterNo").notEmpty().withMessage("encounterNo is required"),
    body("test_name").isString().trim().notEmpty().withMessage("test_name is required").isLength({ max: 200 }),
    body("test_date").optional({ nullable: true }).isISO8601(),
    body("result").optional({ nullable: true }).isString(),
    body("impression").optional({ nullable: true }).isString()

];

export const updateMolecularTestValidation = [

    param("encounterMolecularTestId").notEmpty().withMessage("encounterMolecularTestId is required"),
    body("test_name").optional().isString().trim().notEmpty().withMessage("test_name cannot be blank").isLength({ max: 200 }),
    body("test_date").optional({ nullable: true }).isISO8601(),
    body("result").optional({ nullable: true }).isString(),
    body("impression").optional({ nullable: true }).isString()

];

export const molecularTestIdValidation = [

    param("encounterMolecularTestId").notEmpty().withMessage("encounterMolecularTestId is required")

];

export const syncEncounterImmunizationsValidation = [

    param("encounterNo").notEmpty().withMessage("encounterNo is required"),
    body("rows").optional({ nullable: true }).isArray(),
    body("rows.*.immunization_name").notEmpty().withMessage("immunization_name is required").isString().isLength({ max: 100 }),
    body("rows.*.immunization_code").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("rows.*.immunization_date").optional({ nullable: true }).isISO8601(),
    body("rows.*.response").optional({ nullable: true }).isString()

];

export const syncEncounterPastTreatmentsValidation = [

    param("encounterNo").notEmpty().withMessage("encounterNo is required"),
    body("rows").optional({ nullable: true }).isArray(),
    body("rows.*.treatment_type").notEmpty().withMessage("treatment_type is required").isString().isLength({ max: 100 }),
    body("rows.*.treatment_type_code").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("rows.*.treatment_date").optional({ nullable: true }).isISO8601(),
    body("rows.*.note").optional({ nullable: true }).isString(),
    body("rows.*.treatment_response").optional({ nullable: true }).isString()

];

export const reportIdValidation = [

    param("encounterReportId").notEmpty().withMessage("encounterReportId is required")

];
