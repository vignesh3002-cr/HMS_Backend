"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGeneValidation = exports.createGeneValidation = exports.getTestValidation = exports.listTestsValidation = exports.deleteTestValidation = exports.updateTestValidation = exports.createTestValidation = exports.getGenesValidation = void 0;
const express_validator_1 = require("express-validator");
const genomics_constants_1 = require("./genomics.constants");
// Request-shape checks only. The clinical rules (master membership, duplicate
// genes, transcript required for Present/VUS, future dates) live in the
// service so they can return a full { field, message } list.
exports.getGenesValidation = [
    (0, express_validator_1.query)("site").isString().notEmpty().withMessage("site is required"),
    (0, express_validator_1.query)("sampleType").isString().notEmpty().withMessage("sampleType is required"),
];
const testBodyValidation = [
    (0, express_validator_1.body)("sampleType").isString().notEmpty().withMessage("Sample type is required"),
    (0, express_validator_1.body)("cancerSite").isString().notEmpty().withMessage("Cancer site is required"),
    (0, express_validator_1.body)("reportDate").isString().notEmpty().withMessage("Report date is required"),
    (0, express_validator_1.body)("collectionDate").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("labName").optional({ nullable: true }).isString().isLength({ max: genomics_constants_1.MAX_LAB_NAME_LENGTH }),
    (0, express_validator_1.body)("panelName").optional({ nullable: true }).isString().isLength({ max: genomics_constants_1.MAX_PANEL_NAME_LENGTH }),
    (0, express_validator_1.body)("remarks").optional({ nullable: true }).isString().isLength({ max: genomics_constants_1.MAX_REMARKS_LENGTH }),
    (0, express_validator_1.body)("reportDocumentId").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("encounterNo").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("stagingDetailId").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("results").isArray({ min: 1 }).withMessage("Add at least one gene result"),
    (0, express_validator_1.body)("results.*.geneSymbol").isString().notEmpty().withMessage("Gene is required"),
    (0, express_validator_1.body)("results.*.isOtherGene").optional().isBoolean(),
    (0, express_validator_1.body)("results.*.status").isString().notEmpty().withMessage("Status is required"),
    (0, express_validator_1.body)("results.*.transcriptDetails")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: genomics_constants_1.MAX_TRANSCRIPT_LENGTH })
        .withMessage(`Transcript / variant details must be ${genomics_constants_1.MAX_TRANSCRIPT_LENGTH} characters or fewer`),
];
exports.createTestValidation = [
    (0, express_validator_1.param)("patientId").isString().notEmpty().withMessage("patientId is required"),
    ...testBodyValidation,
];
exports.updateTestValidation = [
    (0, express_validator_1.param)("testId").isString().notEmpty().withMessage("testId is required"),
    ...testBodyValidation,
];
exports.deleteTestValidation = [
    (0, express_validator_1.param)("testId").isString().notEmpty().withMessage("testId is required"),
    (0, express_validator_1.body)("reason")
        .isString()
        .trim()
        .notEmpty()
        .withMessage("A reason is required to delete a report")
        .isLength({ max: genomics_constants_1.MAX_DELETE_REASON_LENGTH }),
];
exports.listTestsValidation = [
    (0, express_validator_1.param)("patientId").isString().notEmpty().withMessage("patientId is required"),
];
exports.getTestValidation = [
    (0, express_validator_1.param)("testId").isString().notEmpty().withMessage("testId is required"),
];
exports.createGeneValidation = [
    (0, express_validator_1.body)("cancerSite").isString().notEmpty().withMessage("Cancer site is required"),
    (0, express_validator_1.body)("scope").isString().notEmpty().withMessage("Scope is required"),
    (0, express_validator_1.body)("geneSymbol").isString().notEmpty().withMessage("Gene symbol is required"),
    (0, express_validator_1.body)("sortOrder").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("source").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("specSite").optional({ nullable: true }).isString(),
];
exports.updateGeneValidation = [
    (0, express_validator_1.param)("geneMasterId").isString().notEmpty().withMessage("geneMasterId is required"),
    (0, express_validator_1.body)("geneSymbol").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("cancerSite").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("scope").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("sortOrder").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("active").optional({ nullable: true }).isBoolean(),
];
