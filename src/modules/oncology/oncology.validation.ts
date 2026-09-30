import { body, param, query } from "express-validator";
import { LATERALITY_VALUES, M_STAGE_VALUES, N_STAGE_VALUES, T_STAGE_VALUES } from "./oncology.constants";

// Request-shape validation only (types, presence, ranges that would otherwise
// throw a raw DB error - e.g. an out-of-range percent). The clinical
// cross-field business rules (V-01..V-08) live in chemo.validation.ts and run
// inside the service layer, returning HTTP 422 on hard failure.

const PERCENT_RULE = { min: 0, max: 100 };

export const getCancerSubtypesValidation = [

    param("cancerTypeId").notEmpty()

];

export const getStagingReferenceValidation = [

    query("cancer_type_id").notEmpty().withMessage("cancer_type_id is required")

];

const ihcBodyValidation = [

    body("ihc").optional({ nullable: true }).isObject().withMessage("ihc must be an object"),
    body("ihc.er_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    body("ihc.pr_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    body("ihc.ki67_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    body("ihc.pdl1_tps").optional({ nullable: true }).isInt(PERCENT_RULE),
    body("ihc.pdl1_cps").optional({ nullable: true }).isInt({ min: 0 }),
    body("ihc.her2_fish_ratio").optional({ nullable: true }).isFloat({ min: 0 }),
    body("ihc.her2_avg_copy").optional({ nullable: true }).isFloat({ min: 0 })

];

const molecularBodyValidation = [

    body("molecular").optional({ nullable: true }).isObject().withMessage("molecular must be an object"),
    body("molecular.tmb").optional({ nullable: true }).isFloat({ min: 0 }),
    body("molecular.hrd_score").optional({ nullable: true }).isFloat({ min: 0 }),
    body("molecular.bcr_abl1").optional({ nullable: true }).isFloat({ min: 0 }),
    body("molecular.flt3_itd_allelic_ratio").optional({ nullable: true }).isFloat({ min: 0 })

];

export const createStagingDetailValidation = [

    body("patient_id").notEmpty().withMessage("patient_id is required"),
    body("encounter_no").optional({ nullable: true }).isString().notEmpty().withMessage("encounter_no cannot be blank when provided"),
    body("diagnosis_id").optional({ nullable: true }).notEmpty().withMessage("diagnosis_id cannot be blank when provided"),
    body("cancer_type_id").notEmpty().withMessage("cancer_type_id is required"),
    body("cancer_subtype_id").notEmpty().withMessage("cancer_subtype_id is required"),
    body("visit_date").optional({ nullable: true }).isISO8601(),
    body("diagnosis_date").optional({ nullable: true }).isISO8601(),
    body("progression_date").optional({ nullable: true }).isISO8601(),
    body("relapse_date").optional({ nullable: true }).isISO8601(),
    body("biopsy_date").optional({ nullable: true }).isISO8601(),
    body("metastasis_sites").optional({ nullable: true }).isArray(),
    body("additional_cancers").optional({ nullable: true }).isArray(),
    body("additional_cancers.*.cancer_type_id").notEmpty().withMessage("Each additional cancer requires a cancer_type_id"),
    body("additional_cancers.*.cancer_subtype_id").optional({ nullable: true }).isString(),
    body("laterality").optional({ nullable: true }).isIn(LATERALITY_VALUES).withMessage(`Laterality must be one of: ${LATERALITY_VALUES.join(", ")}`),
    body("t_stage").optional({ nullable: true }).isIn(T_STAGE_VALUES).withMessage(`T stage must be a single value, one of: ${T_STAGE_VALUES.join(", ")}`),
    body("n_stage").optional({ nullable: true }).isIn(N_STAGE_VALUES).withMessage(`N stage must be a single value, one of: ${N_STAGE_VALUES.join(", ")}`),
    body("m_stage").optional({ nullable: true }).isIn(M_STAGE_VALUES).withMessage(`M stage must be a single value, one of: ${M_STAGE_VALUES.join(", ")}`),
    body("additional_cancers.*.laterality").optional({ nullable: true }).isIn(LATERALITY_VALUES).withMessage(`Laterality must be one of: ${LATERALITY_VALUES.join(", ")}`),
    body("additional_cancers.*.t_stage").optional({ nullable: true }).isIn(T_STAGE_VALUES).withMessage(`T stage must be a single value, one of: ${T_STAGE_VALUES.join(", ")}`),
    body("additional_cancers.*.n_stage").optional({ nullable: true }).isIn(N_STAGE_VALUES).withMessage(`N stage must be a single value, one of: ${N_STAGE_VALUES.join(", ")}`),
    body("additional_cancers.*.m_stage").optional({ nullable: true }).isIn(M_STAGE_VALUES).withMessage(`M stage must be a single value, one of: ${M_STAGE_VALUES.join(", ")}`),
    body("site").optional({ nullable: true }).isString(),
    body("grade").optional({ nullable: true }).isString(),
    body("grade_system").optional({ nullable: true }).isString(),
    body("score").optional({ nullable: true }).isString(),
    body("score_system").optional({ nullable: true }).isString(),
    body("pre_diagnosis").optional({ nullable: true }).isString(),
    body("disease_status").optional({ nullable: true }).isString(),
    body("notes").optional({ nullable: true }).isString(),
    body("performance_status").optional({ nullable: true }).isInt({ min: 0, max: 4 }).withMessage("performance_status must be an ECOG score between 0 and 4"),
    ...ihcBodyValidation,
    ...molecularBodyValidation

];

export const updateStagingDetailValidation = [

    param("stagingDetailId").notEmpty(),
    // diagnosis_id may be omitted (leave unchanged) but never cleared - it's
    // mandatory at creation, so a partial update can't null it out.
    body("diagnosis_id").optional().notEmpty().withMessage("diagnosis_id cannot be cleared"),
    body("visit_date").optional({ nullable: true }).isISO8601(),
    body("diagnosis_date").optional({ nullable: true }).isISO8601(),
    body("progression_date").optional({ nullable: true }).isISO8601(),
    body("relapse_date").optional({ nullable: true }).isISO8601(),
    body("biopsy_date").optional({ nullable: true }).isISO8601(),
    body("metastasis_sites").optional({ nullable: true }).isArray(),
    body("additional_cancers").optional({ nullable: true }).isArray(),
    body("additional_cancers.*.cancer_type_id").notEmpty().withMessage("Each additional cancer requires a cancer_type_id"),
    body("additional_cancers.*.cancer_subtype_id").optional({ nullable: true }).isString(),
    body("laterality").optional({ nullable: true }).isIn(LATERALITY_VALUES).withMessage(`Laterality must be one of: ${LATERALITY_VALUES.join(", ")}`),
    body("t_stage").optional({ nullable: true }).isIn(T_STAGE_VALUES).withMessage(`T stage must be a single value, one of: ${T_STAGE_VALUES.join(", ")}`),
    body("n_stage").optional({ nullable: true }).isIn(N_STAGE_VALUES).withMessage(`N stage must be a single value, one of: ${N_STAGE_VALUES.join(", ")}`),
    body("m_stage").optional({ nullable: true }).isIn(M_STAGE_VALUES).withMessage(`M stage must be a single value, one of: ${M_STAGE_VALUES.join(", ")}`),
    body("additional_cancers.*.laterality").optional({ nullable: true }).isIn(LATERALITY_VALUES).withMessage(`Laterality must be one of: ${LATERALITY_VALUES.join(", ")}`),
    body("additional_cancers.*.t_stage").optional({ nullable: true }).isIn(T_STAGE_VALUES).withMessage(`T stage must be a single value, one of: ${T_STAGE_VALUES.join(", ")}`),
    body("additional_cancers.*.n_stage").optional({ nullable: true }).isIn(N_STAGE_VALUES).withMessage(`N stage must be a single value, one of: ${N_STAGE_VALUES.join(", ")}`),
    body("additional_cancers.*.m_stage").optional({ nullable: true }).isIn(M_STAGE_VALUES).withMessage(`M stage must be a single value, one of: ${M_STAGE_VALUES.join(", ")}`),
    body("site").optional({ nullable: true }).isString(),
    body("grade").optional({ nullable: true }).isString(),
    body("grade_system").optional({ nullable: true }).isString(),
    body("score").optional({ nullable: true }).isString(),
    body("score_system").optional({ nullable: true }).isString(),
    body("pre_diagnosis").optional({ nullable: true }).isString(),
    body("disease_status").optional({ nullable: true }).isString(),
    body("notes").optional({ nullable: true }).isString(),
    body("performance_status").optional({ nullable: true }).isInt({ min: 0, max: 4 }).withMessage("performance_status must be an ECOG score between 0 and 4"),
    ...ihcBodyValidation,
    ...molecularBodyValidation

];

export const upsertIhcValidation = [

    param("stagingDetailId").notEmpty(),
    body("er_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    body("pr_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    body("ki67_percent").optional({ nullable: true }).isInt(PERCENT_RULE),
    body("pdl1_tps").optional({ nullable: true }).isInt(PERCENT_RULE),
    body("pdl1_cps").optional({ nullable: true }).isInt({ min: 0 }),
    body("her2_fish_ratio").optional({ nullable: true }).isFloat({ min: 0 }),
    body("her2_avg_copy").optional({ nullable: true }).isFloat({ min: 0 })

];

export const upsertMolecularValidation = [

    param("stagingDetailId").notEmpty(),
    body("tmb").optional({ nullable: true }).isFloat({ min: 0 }),
    body("hrd_score").optional({ nullable: true }).isFloat({ min: 0 }),
    body("bcr_abl1").optional({ nullable: true }).isFloat({ min: 0 }),
    body("flt3_itd_allelic_ratio").optional({ nullable: true }).isFloat({ min: 0 })

];

export const getStagingDetailValidation = [

    param("stagingDetailId").notEmpty()

];

export const listStagingDetailsValidation = [

    query("encounter_no").optional().isString(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("date_from").optional().isISO8601(),
    query("date_to").optional().isISO8601()

];

export const listInvestigationResultsValidation = [

    query("patient_id").notEmpty().withMessage("patient_id is required")

];

export const saveInvestigationResultsValidation = [

    body("patient_id").notEmpty().withMessage("patient_id is required"),
    body("encounter_no").notEmpty().withMessage("encounter_no is required"),
    body("staging_detail_id").optional({ nullable: true }).isString(),
    body("report_date").isISO8601().withMessage("Report date must be a valid date"),
    body("results").isArray().withMessage("results must be an array"),
    body("results.*.parameter_id").notEmpty().withMessage("Each result needs a parameter_id")

];
