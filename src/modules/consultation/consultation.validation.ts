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
    body("diet_type").optional({ nullable: true }).isString()

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

export const reportIdValidation = [

    param("encounterReportId").notEmpty().withMessage("encounterReportId is required")

];
