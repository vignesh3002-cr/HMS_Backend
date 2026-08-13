"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStagingDetailsValidation = exports.getStagingDetailValidation = exports.upsertMolecularValidation = exports.upsertIhcValidation = exports.updateStagingDetailValidation = exports.createStagingDetailValidation = exports.getStagingReferenceValidation = exports.getCancerSubtypesValidation = void 0;
const express_validator_1 = require("express-validator");
// Request-shape validation only (types, presence, ranges that would otherwise
// throw a raw DB error - e.g. an out-of-range percent). The clinical
// cross-field business rules (V-01..V-08) live in chemo.validation.ts and run
// inside the service layer, returning HTTP 422 on hard failure.
const PERCENT_RULE = { min: 0, max: 100 };
exports.getCancerSubtypesValidation = [
    (0, express_validator_1.param)("cancerTypeId").notEmpty()
];
exports.getStagingReferenceValidation = [
    (0, express_validator_1.query)("cancer_type_id").notEmpty().withMessage("cancer_type_id is required")
];
const ihcBodyValidation = [
    (0, express_validator_1.body)("ihc").optional({ nullable: true }).isObject().withMessage("ihc must be an object"),
    (0, express_validator_1.body)("ihc.er_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    (0, express_validator_1.body)("ihc.pr_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    (0, express_validator_1.body)("ihc.ki67_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    (0, express_validator_1.body)("ihc.pdl1_tps").optional({ nullable: true }).isInt(PERCENT_RULE),
    (0, express_validator_1.body)("ihc.pdl1_cps").optional({ nullable: true }).isInt({ min: 0 }),
    (0, express_validator_1.body)("ihc.her2_fish_ratio").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("ihc.her2_avg_copy").optional({ nullable: true }).isFloat({ min: 0 })
];
const molecularBodyValidation = [
    (0, express_validator_1.body)("molecular").optional({ nullable: true }).isObject().withMessage("molecular must be an object"),
    (0, express_validator_1.body)("molecular.tmb").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("molecular.hrd_score").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("molecular.bcr_abl1").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("molecular.flt3_itd_allelic_ratio").optional({ nullable: true }).isFloat({ min: 0 })
];
exports.createStagingDetailValidation = [
    (0, express_validator_1.body)("patient_id").notEmpty().withMessage("patient_id is required"),
    (0, express_validator_1.body)("diagnosis_id").notEmpty().withMessage("diagnosis_id is required"),
    (0, express_validator_1.body)("cancer_type_id").notEmpty().withMessage("cancer_type_id is required"),
    (0, express_validator_1.body)("cancer_subtype_id").notEmpty().withMessage("cancer_subtype_id is required"),
    (0, express_validator_1.body)("visit_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("diagnosis_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("biopsy_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("metastasis_sites").optional({ nullable: true }).isArray(),
    (0, express_validator_1.body)("performance_status").optional({ nullable: true }).isInt({ min: 0, max: 4 }).withMessage("performance_status must be an ECOG score between 0 and 4"),
    ...ihcBodyValidation,
    ...molecularBodyValidation
];
exports.updateStagingDetailValidation = [
    (0, express_validator_1.param)("stagingDetailId").notEmpty(),
    // diagnosis_id may be omitted (leave unchanged) but never cleared - it's
    // mandatory at creation, so a partial update can't null it out.
    (0, express_validator_1.body)("diagnosis_id").optional().notEmpty().withMessage("diagnosis_id cannot be cleared"),
    (0, express_validator_1.body)("visit_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("diagnosis_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("biopsy_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("metastasis_sites").optional({ nullable: true }).isArray(),
    (0, express_validator_1.body)("performance_status").optional({ nullable: true }).isInt({ min: 0, max: 4 }).withMessage("performance_status must be an ECOG score between 0 and 4"),
    ...ihcBodyValidation,
    ...molecularBodyValidation
];
exports.upsertIhcValidation = [
    (0, express_validator_1.param)("stagingDetailId").notEmpty(),
    (0, express_validator_1.body)("er_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    (0, express_validator_1.body)("pr_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    (0, express_validator_1.body)("ki67_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    (0, express_validator_1.body)("pdl1_tps").optional({ nullable: true }).isInt(PERCENT_RULE),
    (0, express_validator_1.body)("pdl1_cps").optional({ nullable: true }).isInt({ min: 0 }),
    (0, express_validator_1.body)("her2_fish_ratio").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("her2_avg_copy").optional({ nullable: true }).isFloat({ min: 0 })
];
exports.upsertMolecularValidation = [
    (0, express_validator_1.param)("stagingDetailId").notEmpty(),
    (0, express_validator_1.body)("tmb").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("hrd_score").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("bcr_abl1").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("flt3_itd_allelic_ratio").optional({ nullable: true }).isFloat({ min: 0 })
];
exports.getStagingDetailValidation = [
    (0, express_validator_1.param)("stagingDetailId").notEmpty()
];
exports.listStagingDetailsValidation = [
    (0, express_validator_1.query)("page").optional().isInt({ min: 1 }),
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)("date_from").optional().isISO8601(),
    (0, express_validator_1.query)("date_to").optional().isISO8601()
];
