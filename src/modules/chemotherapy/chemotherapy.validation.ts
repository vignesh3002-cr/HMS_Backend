import { body, param, query } from "express-validator";
import { PLAN_STATUS, CYCLE_STATUS, DRUG_ROLE } from "./chemotherapy.constants";

export const previewPlanValidation = [

    query("staging_detail_id").notEmpty().withMessage("staging_detail_id is required")

];

export const listRegimenProtocolsValidation = [

    query("cancer_type_id").optional().notEmpty(),
    query("subtype_id").optional().notEmpty()

];

export const getRegimenProtocolValidation = [

    param("protocolId").notEmpty()

];

export const createRegimenProtocolValidation = [

    body("regimen_code").notEmpty().withMessage("regimen_code is required"),
    body("regimen_name").notEmpty().withMessage("regimen_name is required"),
    body("cancer_type_id").notEmpty().withMessage("cancer_type_id is required"),
    body("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    body("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("items").isArray({ min: 1 }).withMessage("At least one protocol item (drug) is required"),
    body("items.*.medicine_id").notEmpty().withMessage("Each protocol item requires a medicine_id"),
    body("items.*.drug_sequence").isInt({ min: 1 }).withMessage("Each protocol item requires a drug_sequence >= 1"),
    body("items.*.drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`)

];

export const updateRegimenProtocolValidation = [

    param("protocolId").notEmpty(),
    body("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    body("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 })

];

export const addRegimenProtocolItemValidation = [

    param("protocolId").notEmpty(),
    body("medicine_id").notEmpty().withMessage("medicine_id is required"),
    body("drug_sequence").isInt({ min: 1 }).withMessage("drug_sequence must be at least 1"),
    body("drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`)

];

export const createPlanValidation = [

    body("patient_id").notEmpty().withMessage("patient_id is required"),
    body("staging_detail_id").notEmpty().withMessage("staging_detail_id is required"),
    body("diagnosis_id").notEmpty().withMessage("diagnosis_id is required"),
    body("employee_id").notEmpty().withMessage("employee_id is required"),
    body("department_id").notEmpty().withMessage("department_id is required"),
    body("branch_id").notEmpty().withMessage("branch_id is required"),
    // protocol_id, regimen_name, planned_cycles, and plan_items have a
    // "provide it explicitly OR select a protocol_id to default it" relationship
    // that's cross-field, so only shape/type is checked here - the service
    // layer enforces the actual "one of these must resolve to a value" rule.
    body("protocol_id").optional({ nullable: true }).notEmpty(),
    body("regimen_name").optional().notEmpty(),
    body("planned_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    body("treatment_start_date").notEmpty().isISO8601().withMessage("treatment_start_date must be a valid date"),
    body("expected_end_date").optional({ nullable: true }).isISO8601(),
    body("consent_date").optional({ nullable: true }).isISO8601(),
    body("confirm_suggested_therapy")
        .custom((value) => value === true)
        .withMessage("confirm_suggested_therapy must be true"),
    body("plan_items").optional({ nullable: true }).isArray({ min: 1 }).withMessage("plan_items, if provided, must be a non-empty array"),
    body("plan_items.*.medicine_id").notEmpty().withMessage("Each plan item requires a medicine_id"),
    body("plan_items.*.drug_sequence").isInt({ min: 1 }).withMessage("Each plan item requires a drug_sequence >= 1"),
    body("plan_items.*.drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`)

];

export const updatePlanValidation = [

    param("planId").notEmpty(),
    body("planned_cycles").optional().isInt({ min: 1 }),
    body("expected_end_date").optional({ nullable: true }).isISO8601(),
    body("consent_date").optional({ nullable: true }).isISO8601()

];

export const planStatusValidation = [

    param("planId").notEmpty(),
    body("status").isIn(Object.values(PLAN_STATUS)).withMessage(`status must be one of: ${Object.values(PLAN_STATUS).join(", ")}`)

];

export const listPlansValidation = [

    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("date_from").optional().isISO8601(),
    query("date_to").optional().isISO8601()

];

export const addPlanItemValidation = [

    param("planId").notEmpty(),
    body("medicine_id").notEmpty().withMessage("medicine_id is required"),
    body("drug_sequence").isInt({ min: 1 }).withMessage("drug_sequence must be at least 1"),
    body("drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`)

];

export const updatePlanItemValidation = [

    param("planId").notEmpty(),
    param("planItemId").notEmpty(),
    body("drug_sequence").optional().isInt({ min: 1 })

];

export const createCycleValidation = [

    param("planId").notEmpty(),
    body("cycle_number").isInt({ min: 1 }).withMessage("cycle_number must be at least 1"),
    body("planned_date").notEmpty().isISO8601().withMessage("planned_date must be a valid date")

];

export const cycleStatusValidation = [

    param("cycleId").notEmpty(),
    body("status").isIn(Object.values(CYCLE_STATUS)).withMessage(`status must be one of: ${Object.values(CYCLE_STATUS).join(", ")}`)

];

export const updateCycleValidation = [

    param("cycleId").notEmpty(),
    body("planned_date").optional().isISO8601(),
    body("rescheduled_date").optional({ nullable: true }).isISO8601(),
    body("delay_days").optional({ nullable: true }).isInt({ min: 0 })

];

export const recordAdministrationValidation = [

    param("cycleId").notEmpty(),
    body("chemotherapy_plan_item_id").notEmpty().withMessage("chemotherapy_plan_item_id is required"),
    body("administration_date").notEmpty().isISO8601().withMessage("administration_date must be a valid date"),
    body("administered_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 })

];

export const recordVitalsValidation = [

    param("cycleId").notEmpty(),
    body("blood_pressure_systolic").optional({ nullable: true }).isInt({ min: 0, max: 300 }),
    body("blood_pressure_diastolic").optional({ nullable: true }).isInt({ min: 0, max: 200 }),
    body("pulse_rate").optional({ nullable: true }).isInt({ min: 0, max: 300 }),
    body("spo2").optional({ nullable: true }).isInt({ min: 0, max: 100 }),
    body("pain_score").optional({ nullable: true }).isInt({ min: 0, max: 10 })

];

export const recordAdverseEventValidation = [

    param("cycleId").notEmpty(),
    body("adverse_event_name").notEmpty().withMessage("adverse_event_name is required"),
    body("event_date").optional({ nullable: true }).isISO8601(),
    body("resolution_date").optional({ nullable: true }).isISO8601(),
    body("reduction_percentage").optional({ nullable: true }).isFloat({ min: 0, max: 100 })

];

export const recordLabReviewValidation = [

    param("cycleId").notEmpty()

];

export const recordFollowupValidation = [

    param("cycleId").notEmpty(),
    body("followup_date").notEmpty().isISO8601().withMessage("followup_date must be a valid date"),
    body("next_followup_date").optional({ nullable: true }).isISO8601(),
    body("progression_date").optional({ nullable: true }).isISO8601(),
    body("recurrence_date").optional({ nullable: true }).isISO8601()

];

export const cycleIdParamValidation = [

    param("cycleId").notEmpty()

];

export const planIdParamValidation = [

    param("planId").notEmpty()

];
