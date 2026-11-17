import { body, param, query } from "express-validator";
import {
    MAX_DELETE_REASON_LENGTH,
    MAX_LAB_NAME_LENGTH,
    MAX_PANEL_NAME_LENGTH,
    MAX_REMARKS_LENGTH,
    MAX_TRANSCRIPT_LENGTH,
} from "./genomics.constants";

// Request-shape checks only. The clinical rules (master membership, duplicate
// genes, transcript required for Present/VUS, future dates) live in the
// service so they can return a full { field, message } list.

export const getGenesValidation = [
    query("site").isString().notEmpty().withMessage("site is required"),
    query("sampleType").isString().notEmpty().withMessage("sampleType is required"),
];

const testBodyValidation = [
    body("sampleType").isString().notEmpty().withMessage("Sample type is required"),
    body("cancerSite").isString().notEmpty().withMessage("Cancer site is required"),
    body("reportDate").isString().notEmpty().withMessage("Report date is required"),
    body("collectionDate").optional({ nullable: true }).isString(),
    body("labName").optional({ nullable: true }).isString().isLength({ max: MAX_LAB_NAME_LENGTH }),
    body("panelName").optional({ nullable: true }).isString().isLength({ max: MAX_PANEL_NAME_LENGTH }),
    body("remarks").optional({ nullable: true }).isString().isLength({ max: MAX_REMARKS_LENGTH }),
    body("reportDocumentId").optional({ nullable: true }).isString(),
    body("encounterNo").optional({ nullable: true }).isString(),
    body("stagingDetailId").optional({ nullable: true }).isString(),
    body("results").isArray({ min: 1 }).withMessage("Add at least one gene result"),
    body("results.*.geneSymbol").isString().notEmpty().withMessage("Gene is required"),
    body("results.*.isOtherGene").optional().isBoolean(),
    body("results.*.status").isString().notEmpty().withMessage("Status is required"),
    body("results.*.transcriptDetails")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: MAX_TRANSCRIPT_LENGTH })
        .withMessage(`Transcript / variant details must be ${MAX_TRANSCRIPT_LENGTH} characters or fewer`),
];

export const createTestValidation = [
    param("patientId").isString().notEmpty().withMessage("patientId is required"),
    ...testBodyValidation,
];

export const updateTestValidation = [
    param("testId").isString().notEmpty().withMessage("testId is required"),
    ...testBodyValidation,
];

export const deleteTestValidation = [
    param("testId").isString().notEmpty().withMessage("testId is required"),
    body("reason")
        .isString()
        .trim()
        .notEmpty()
        .withMessage("A reason is required to delete a report")
        .isLength({ max: MAX_DELETE_REASON_LENGTH }),
];

export const listTestsValidation = [
    param("patientId").isString().notEmpty().withMessage("patientId is required"),
];

export const getTestValidation = [
    param("testId").isString().notEmpty().withMessage("testId is required"),
];

export const createGeneValidation = [
    body("cancerSite").isString().notEmpty().withMessage("Cancer site is required"),
    body("scope").isString().notEmpty().withMessage("Scope is required"),
    body("geneSymbol").isString().notEmpty().withMessage("Gene symbol is required"),
    body("sortOrder").optional({ nullable: true }).isInt({ min: 1 }),
    body("source").optional({ nullable: true }).isString(),
    body("specSite").optional({ nullable: true }).isString(),
];

export const updateGeneValidation = [
    param("geneMasterId").isString().notEmpty().withMessage("geneMasterId is required"),
    body("geneSymbol").optional({ nullable: true }).isString(),
    body("cancerSite").optional({ nullable: true }).isString(),
    body("scope").optional({ nullable: true }).isString(),
    body("sortOrder").optional({ nullable: true }).isInt({ min: 1 }),
    body("active").optional({ nullable: true }).isBoolean(),
];
