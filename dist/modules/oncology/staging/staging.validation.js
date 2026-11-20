"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stageRecordIdValidation = exports.saveStageRecordsValidation = exports.listStageHistoryValidation = exports.listStageRecordsValidation = exports.deriveStageValidation = exports.getStagingSchemaValidation = exports.listStagingSchemasValidation = void 0;
const express_validator_1 = require("express-validator");
const types_1 = require("./types");
// Request-shape validation for the TNM staging module. Business rules
// (codes belong to the schema, override reason length, stage date window,
// one active stage per context) live in StagingService.
const CODE_RULE = { max: 50 };
const TEXT_RULE = { max: 2000 };
const codeField = (path) => (0, express_validator_1.body)(path).optional({ nullable: true }).isString().isLength(CODE_RULE);
exports.listStagingSchemasValidation = [
    (0, express_validator_1.param)("cancerTypeId").notEmpty(),
    (0, express_validator_1.query)("patientId").optional({ nullable: true }).isString(),
];
exports.getStagingSchemaValidation = [
    (0, express_validator_1.param)("schemaId").notEmpty(),
    (0, express_validator_1.query)("context").optional({ nullable: true }).isIn(types_1.CONTEXT_VALUES),
];
exports.deriveStageValidation = [
    (0, express_validator_1.body)("schemaId").isString().bail().trim().notEmpty().withMessage("schemaId is required"),
    (0, express_validator_1.body)("context").isIn(types_1.CONTEXT_VALUES).withMessage("context is not a staging context"),
    codeField("t"),
    codeField("n"),
    codeField("m"),
    codeField("s"),
    (0, express_validator_1.body)("conditions").optional({ nullable: true }).isObject(),
];
exports.listStageRecordsValidation = [
    (0, express_validator_1.query)("stagingDetailId").isString().bail().trim().notEmpty().withMessage("stagingDetailId is required"),
];
exports.listStageHistoryValidation = [
    (0, express_validator_1.query)("patientId").isString().bail().trim().notEmpty().withMessage("patientId is required"),
    (0, express_validator_1.query)("cancerTypeId").optional({ nullable: true }).isString(),
];
exports.saveStageRecordsValidation = [
    (0, express_validator_1.body)("stagingDetailId").isString().bail().trim().notEmpty().withMessage("stagingDetailId is required"),
    (0, express_validator_1.body)("replace").optional().isBoolean(),
    (0, express_validator_1.body)("records").isArray().withMessage("records must be an array"),
    (0, express_validator_1.body)("records.*.cancerTypeId").optional({ nullable: true }).isString().isLength({ max: 100 }),
    (0, express_validator_1.body)("records.*.schemaId").isString().bail().trim().notEmpty().withMessage("A schema is required for every stage"),
    (0, express_validator_1.body)("records.*.context").isIn(types_1.CONTEXT_VALUES).withMessage("A stage context is required"),
    codeField("records.*.t"),
    codeField("records.*.n"),
    codeField("records.*.m"),
    codeField("records.*.s"),
    (0, express_validator_1.body)("records.*.conditions").optional({ nullable: true }).isObject(),
    (0, express_validator_1.body)("records.*.modifiers").optional({ nullable: true }).isObject(),
    (0, express_validator_1.body)("records.*.finalStage").optional({ nullable: true }).isString().isLength(CODE_RULE),
    (0, express_validator_1.body)("records.*.isOverridden").optional().isBoolean(),
    (0, express_validator_1.body)("records.*.overrideReason").optional({ nullable: true }).isString().isLength(TEXT_RULE),
    (0, express_validator_1.body)("records.*.stageDate").optional({ nullable: true }).isISO8601().withMessage("stageDate must be a date"),
    (0, express_validator_1.body)("records.*.notes").optional({ nullable: true }).isString().isLength(TEXT_RULE),
];
exports.stageRecordIdValidation = [
    (0, express_validator_1.param)("stageRecordId").notEmpty(),
];
