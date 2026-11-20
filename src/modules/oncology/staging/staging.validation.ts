import { body, param, query } from "express-validator";
import { CONTEXT_VALUES } from "./types";

// Request-shape validation for the TNM staging module. Business rules
// (codes belong to the schema, override reason length, stage date window,
// one active stage per context) live in StagingService.

const CODE_RULE = { max: 50 };
const TEXT_RULE = { max: 2000 };

const codeField = (path: string) =>
    body(path).optional({ nullable: true }).isString().isLength(CODE_RULE);

export const listStagingSchemasValidation = [
    param("cancerTypeId").notEmpty(),
    query("patientId").optional({ nullable: true }).isString(),
];

export const getStagingSchemaValidation = [
    param("schemaId").notEmpty(),
    query("context").optional({ nullable: true }).isIn(CONTEXT_VALUES as string[]),
];

export const deriveStageValidation = [
    body("schemaId").isString().bail().trim().notEmpty().withMessage("schemaId is required"),
    body("context").isIn(CONTEXT_VALUES as string[]).withMessage("context is not a staging context"),
    codeField("t"),
    codeField("n"),
    codeField("m"),
    codeField("s"),
    body("conditions").optional({ nullable: true }).isObject(),
];

export const listStageRecordsValidation = [
    query("stagingDetailId").isString().bail().trim().notEmpty().withMessage("stagingDetailId is required"),
];

export const listStageHistoryValidation = [
    query("patientId").isString().bail().trim().notEmpty().withMessage("patientId is required"),
    query("cancerTypeId").optional({ nullable: true }).isString(),
];

export const saveStageRecordsValidation = [
    body("stagingDetailId").isString().bail().trim().notEmpty().withMessage("stagingDetailId is required"),
    body("replace").optional().isBoolean(),
    body("records").isArray().withMessage("records must be an array"),
    body("records.*.cancerTypeId").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("records.*.schemaId").isString().bail().trim().notEmpty().withMessage("A schema is required for every stage"),
    body("records.*.context").isIn(CONTEXT_VALUES as string[]).withMessage("A stage context is required"),
    codeField("records.*.t"),
    codeField("records.*.n"),
    codeField("records.*.m"),
    codeField("records.*.s"),
    body("records.*.conditions").optional({ nullable: true }).isObject(),
    body("records.*.modifiers").optional({ nullable: true }).isObject(),
    body("records.*.finalStage").optional({ nullable: true }).isString().isLength(CODE_RULE),
    body("records.*.isOverridden").optional().isBoolean(),
    body("records.*.overrideReason").optional({ nullable: true }).isString().isLength(TEXT_RULE),
    body("records.*.stageDate").optional({ nullable: true }).isISO8601().withMessage("stageDate must be a date"),
    body("records.*.notes").optional({ nullable: true }).isString().isLength(TEXT_RULE),
];

export const stageRecordIdValidation = [
    param("stageRecordId").notEmpty(),
];
