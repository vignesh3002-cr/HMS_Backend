"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planIdParamValidation = exports.cycleIdParamValidation = exports.recordFollowupValidation = exports.recordLabReviewValidation = exports.recordAdverseEventValidation = exports.recordVitalsValidation = exports.recordAdministrationValidation = exports.updateCycleValidation = exports.cycleStatusValidation = exports.createCycleValidation = exports.updatePlanItemValidation = exports.addPlanItemValidation = exports.listPlansValidation = exports.planStatusValidation = exports.updatePlanValidation = exports.createPlanValidation = exports.addRegimenProtocolItemValidation = exports.createPersonalizedProtocolVersionValidation = exports.removePersonalizedProtocolDilutionValidation = exports.updatePersonalizedProtocolDilutionValidation = exports.addPersonalizedProtocolDilutionValidation = exports.removePersonalizedProtocolDayValidation = exports.updatePersonalizedProtocolDayValidation = exports.addPersonalizedProtocolDayValidation = exports.removePersonalizedProtocolItemValidation = exports.updatePersonalizedProtocolItemValidation = exports.addPersonalizedProtocolItemValidation = exports.updatePersonalizedProtocolValidation = exports.personalizeRegimenProtocolValidation = exports.protocolIdParamValidation = exports.updateRegimenProtocolValidation = exports.createRegimenProtocolValidation = exports.getRegimenProtocolValidation = exports.listRegimenProtocolsValidation = exports.previewPlanValidation = void 0;
const express_validator_1 = require("express-validator");
const chemotherapy_constants_1 = require("./chemotherapy.constants");
exports.previewPlanValidation = [
    (0, express_validator_1.query)("staging_detail_id").notEmpty().withMessage("staging_detail_id is required")
];
exports.listRegimenProtocolsValidation = [
    (0, express_validator_1.query)("cancer_type_id").optional().notEmpty(),
    (0, express_validator_1.query)("subtype_id").optional().notEmpty()
];
exports.getRegimenProtocolValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty()
];
exports.createRegimenProtocolValidation = [
    (0, express_validator_1.body)("regimen_code").notEmpty().withMessage("regimen_code is required"),
    (0, express_validator_1.body)("regimen_name").notEmpty().withMessage("regimen_name is required"),
    (0, express_validator_1.body)("cancer_type_id").notEmpty().withMessage("cancer_type_id is required"),
    (0, express_validator_1.body)("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("items").isArray({ min: 1 }).withMessage("At least one protocol item (drug) is required"),
    (0, express_validator_1.body)("items.*.medicine_id").notEmpty().withMessage("Each protocol item requires a medicine_id"),
    (0, express_validator_1.body)("items.*.drug_sequence").isInt({ min: 1 }).withMessage("Each protocol item requires a drug_sequence >= 1"),
    (0, express_validator_1.body)("items.*.drug_role").optional().isIn(Object.values(chemotherapy_constants_1.DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(chemotherapy_constants_1.DRUG_ROLE).join(", ")}`)
];
exports.updateRegimenProtocolValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.body)("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 })
];
// ---------------- Personalized regimen protocols ----------------
exports.protocolIdParamValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty()
];
exports.personalizeRegimenProtocolValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.body)("regimen_name").optional().notEmpty(),
    (0, express_validator_1.body)("treatment_intent").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("guideline_source").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("notes").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("composition").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("additional_notes").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("no_of_days").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("day_care_referred").optional({ nullable: true }).isBoolean(),
    (0, express_validator_1.body)("create_day_care_appointment").optional({ nullable: true }).isBoolean(),
    (0, express_validator_1.body)("protocol_version").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("days").optional({ nullable: true }).isArray(),
    (0, express_validator_1.body)("days.*.protocol_day_id").optional().notEmpty(),
    (0, express_validator_1.body)("days.*.day_number").isInt({ min: 1 }).withMessage("Each day requires a day_number >= 1"),
    (0, express_validator_1.body)("days.*.day_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("days.*.same_as_day_one").optional({ nullable: true }).isBoolean(),
    (0, express_validator_1.body)("days.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 }),
    (0, express_validator_1.body)("items").optional({ nullable: true }).isArray(),
    (0, express_validator_1.body)("items.*.protocol_item_id").optional().notEmpty(),
    (0, express_validator_1.body)("items.*.medicine_id").notEmpty().withMessage("Each item requires a medicine_id"),
    (0, express_validator_1.body)("items.*.drug_role").optional().isIn(Object.values(chemotherapy_constants_1.DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(chemotherapy_constants_1.DRUG_ROLE).join(", ")}`),
    (0, express_validator_1.body)("items.*.drug_sequence").isInt({ min: 1 }).withMessage("Each item requires a drug_sequence >= 1"),
    (0, express_validator_1.body)("items.*.dosage").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("items.*.infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 }),
    (0, express_validator_1.body)("items.*.administration_day").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("items.*.cycle_day").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("items.*.protocol_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("items.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 }),
    (0, express_validator_1.body)("items.*.dilutions").optional({ nullable: true }).isArray(),
    (0, express_validator_1.body)("items.*.dilutions.*.medicine_id").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("items.*.dilutions.*.dose").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("items.*.dilutions.*.dilution_volume").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("items.*.dilutions.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })
];
exports.updatePersonalizedProtocolValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.body)("regimen_name").optional().notEmpty(),
    (0, express_validator_1.body)("treatment_intent").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("guideline_source").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("notes").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("composition").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("additional_notes").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("no_of_days").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("day_care_referred").optional({ nullable: true }).isBoolean(),
    (0, express_validator_1.body)("create_day_care_appointment").optional({ nullable: true }).isBoolean(),
    (0, express_validator_1.body)("protocol_version").optional({ nullable: true }).notEmpty()
];
exports.addPersonalizedProtocolItemValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.body)("medicine_id").notEmpty().withMessage("medicine_id is required"),
    (0, express_validator_1.body)("drug_sequence").isInt({ min: 1 }).withMessage("drug_sequence must be at least 1"),
    (0, express_validator_1.body)("drug_role").optional().isIn(Object.values(chemotherapy_constants_1.DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(chemotherapy_constants_1.DRUG_ROLE).join(", ")}`),
    (0, express_validator_1.body)("dosage").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 }),
    (0, express_validator_1.body)("administration_day").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("cycle_day").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("protocol_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })
];
exports.updatePersonalizedProtocolItemValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.param)("protocolItemId").notEmpty(),
    (0, express_validator_1.body)("medicine_id").optional().notEmpty(),
    (0, express_validator_1.body)("drug_sequence").optional().isInt({ min: 1 }),
    (0, express_validator_1.body)("drug_role").optional().isIn(Object.values(chemotherapy_constants_1.DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(chemotherapy_constants_1.DRUG_ROLE).join(", ")}`),
    (0, express_validator_1.body)("dosage").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 }),
    (0, express_validator_1.body)("administration_day").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("cycle_day").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("protocol_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })
];
exports.removePersonalizedProtocolItemValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.param)("protocolItemId").notEmpty()
];
exports.addPersonalizedProtocolDayValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.body)("day_number").isInt({ min: 1 }).withMessage("day_number must be at least 1"),
    (0, express_validator_1.body)("day_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("same_as_day_one").optional({ nullable: true }).isBoolean(),
    (0, express_validator_1.body)("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })
];
exports.updatePersonalizedProtocolDayValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.param)("protocolDayId").notEmpty(),
    (0, express_validator_1.body)("day_number").optional().isInt({ min: 1 }),
    (0, express_validator_1.body)("day_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("same_as_day_one").optional({ nullable: true }).isBoolean(),
    (0, express_validator_1.body)("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })
];
exports.removePersonalizedProtocolDayValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.param)("protocolDayId").notEmpty()
];
exports.addPersonalizedProtocolDilutionValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.param)("protocolItemId").notEmpty(),
    (0, express_validator_1.body)("medicine_id").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("dose").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("dilution_volume").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })
];
exports.updatePersonalizedProtocolDilutionValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.param)("protocolItemId").notEmpty(),
    (0, express_validator_1.param)("protocolDilutionId").notEmpty(),
    (0, express_validator_1.body)("medicine_id").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("dose").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("dilution_volume").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })
];
exports.removePersonalizedProtocolDilutionValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.param)("protocolItemId").notEmpty(),
    (0, express_validator_1.param)("protocolDilutionId").notEmpty()
];
exports.createPersonalizedProtocolVersionValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.body)("reason").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("notes").optional({ nullable: true }).notEmpty()
];
exports.addRegimenProtocolItemValidation = [
    (0, express_validator_1.param)("protocolId").notEmpty(),
    (0, express_validator_1.body)("medicine_id").notEmpty().withMessage("medicine_id is required"),
    (0, express_validator_1.body)("drug_sequence").isInt({ min: 1 }).withMessage("drug_sequence must be at least 1"),
    (0, express_validator_1.body)("drug_role").optional().isIn(Object.values(chemotherapy_constants_1.DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(chemotherapy_constants_1.DRUG_ROLE).join(", ")}`)
];
exports.createPlanValidation = [
    (0, express_validator_1.body)("patient_id").notEmpty().withMessage("patient_id is required"),
    (0, express_validator_1.body)("staging_detail_id").notEmpty().withMessage("staging_detail_id is required"),
    (0, express_validator_1.body)("diagnosis_id").notEmpty().withMessage("diagnosis_id is required"),
    (0, express_validator_1.body)("employee_id").notEmpty().withMessage("employee_id is required"),
    (0, express_validator_1.body)("department_id").notEmpty().withMessage("department_id is required"),
    (0, express_validator_1.body)("branch_id").notEmpty().withMessage("branch_id is required"),
    // appointment_id and encounter_no are optional but allowed
    (0, express_validator_1.body)("appointment_id").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("encounter_no").optional({ nullable: true }).notEmpty(),
    // protocol_id, regimen_name, planned_cycles, and plan_items have a
    // "provide it explicitly OR select a protocol_id to default it" relationship
    // that's cross-field, so only shape/type is checked here - the service
    // layer enforces the actual "one of these must resolve to a value" rule.
    (0, express_validator_1.body)("protocol_id").optional({ nullable: true }).notEmpty(),
    (0, express_validator_1.body)("regimen_name").optional().notEmpty(),
    (0, express_validator_1.body)("planned_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("treatment_start_date").notEmpty().isISO8601().withMessage("treatment_start_date must be a valid date"),
    (0, express_validator_1.body)("expected_end_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("consent_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("confirm_suggested_therapy")
        .custom((value) => value === true)
        .withMessage("confirm_suggested_therapy must be true"),
    (0, express_validator_1.body)("plan_items").optional({ nullable: true }).isArray({ min: 1 }).withMessage("plan_items, if provided, must be a non-empty array"),
    (0, express_validator_1.body)("plan_items.*.medicine_id").notEmpty().withMessage("Each plan item requires a medicine_id"),
    (0, express_validator_1.body)("plan_items.*.drug_sequence").isInt({ min: 1 }).withMessage("Each plan item requires a drug_sequence >= 1"),
    (0, express_validator_1.body)("plan_items.*.drug_role").optional().isIn(Object.values(chemotherapy_constants_1.DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(chemotherapy_constants_1.DRUG_ROLE).join(", ")}`)
];
exports.updatePlanValidation = [
    (0, express_validator_1.param)("planId").notEmpty(),
    (0, express_validator_1.body)("planned_cycles").optional().isInt({ min: 1 }),
    (0, express_validator_1.body)("expected_end_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("consent_date").optional({ nullable: true }).isISO8601()
];
exports.planStatusValidation = [
    (0, express_validator_1.param)("planId").notEmpty(),
    (0, express_validator_1.body)("status").isIn(Object.values(chemotherapy_constants_1.PLAN_STATUS)).withMessage(`status must be one of: ${Object.values(chemotherapy_constants_1.PLAN_STATUS).join(", ")}`)
];
exports.listPlansValidation = [
    (0, express_validator_1.query)("page").optional().isInt({ min: 1 }),
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)("date_from").optional().isISO8601(),
    (0, express_validator_1.query)("date_to").optional().isISO8601()
];
exports.addPlanItemValidation = [
    (0, express_validator_1.param)("planId").notEmpty(),
    (0, express_validator_1.body)("medicine_id").notEmpty().withMessage("medicine_id is required"),
    (0, express_validator_1.body)("drug_sequence").isInt({ min: 1 }).withMessage("drug_sequence must be at least 1"),
    (0, express_validator_1.body)("drug_role").optional().isIn(Object.values(chemotherapy_constants_1.DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(chemotherapy_constants_1.DRUG_ROLE).join(", ")}`)
];
exports.updatePlanItemValidation = [
    (0, express_validator_1.param)("planId").notEmpty(),
    (0, express_validator_1.param)("planItemId").notEmpty(),
    (0, express_validator_1.body)("drug_sequence").optional().isInt({ min: 1 })
];
exports.createCycleValidation = [
    (0, express_validator_1.param)("planId").notEmpty(),
    (0, express_validator_1.body)("cycle_number").isInt({ min: 1 }).withMessage("cycle_number must be at least 1"),
    (0, express_validator_1.body)("planned_date").notEmpty().isISO8601().withMessage("planned_date must be a valid date")
];
exports.cycleStatusValidation = [
    (0, express_validator_1.param)("cycleId").notEmpty(),
    (0, express_validator_1.body)("status").isIn(Object.values(chemotherapy_constants_1.CYCLE_STATUS)).withMessage(`status must be one of: ${Object.values(chemotherapy_constants_1.CYCLE_STATUS).join(", ")}`)
];
exports.updateCycleValidation = [
    (0, express_validator_1.param)("cycleId").notEmpty(),
    (0, express_validator_1.body)("planned_date").optional().isISO8601(),
    (0, express_validator_1.body)("rescheduled_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("delay_days").optional({ nullable: true }).isInt({ min: 0 })
];
exports.recordAdministrationValidation = [
    (0, express_validator_1.param)("cycleId").notEmpty(),
    (0, express_validator_1.body)("chemotherapy_plan_item_id").notEmpty().withMessage("chemotherapy_plan_item_id is required"),
    (0, express_validator_1.body)("administration_date").notEmpty().isISO8601().withMessage("administration_date must be a valid date"),
    (0, express_validator_1.body)("administered_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    (0, express_validator_1.body)("infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 })
];
exports.recordVitalsValidation = [
    (0, express_validator_1.param)("cycleId").notEmpty(),
    (0, express_validator_1.body)("blood_pressure_systolic").optional({ nullable: true }).isInt({ min: 0, max: 300 }),
    (0, express_validator_1.body)("blood_pressure_diastolic").optional({ nullable: true }).isInt({ min: 0, max: 200 }),
    (0, express_validator_1.body)("pulse_rate").optional({ nullable: true }).isInt({ min: 0, max: 300 }),
    (0, express_validator_1.body)("spo2").optional({ nullable: true }).isInt({ min: 0, max: 100 }),
    (0, express_validator_1.body)("pain_score").optional({ nullable: true }).isInt({ min: 0, max: 10 })
];
exports.recordAdverseEventValidation = [
    (0, express_validator_1.param)("cycleId").notEmpty(),
    (0, express_validator_1.body)("adverse_event_name").notEmpty().withMessage("adverse_event_name is required"),
    (0, express_validator_1.body)("event_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("resolution_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("reduction_percentage").optional({ nullable: true }).isFloat({ min: 0, max: 100 })
];
exports.recordLabReviewValidation = [
    (0, express_validator_1.param)("cycleId").notEmpty()
];
exports.recordFollowupValidation = [
    (0, express_validator_1.param)("cycleId").notEmpty(),
    (0, express_validator_1.body)("followup_date").notEmpty().isISO8601().withMessage("followup_date must be a valid date"),
    (0, express_validator_1.body)("next_followup_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("progression_date").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("recurrence_date").optional({ nullable: true }).isISO8601()
];
exports.cycleIdParamValidation = [
    (0, express_validator_1.param)("cycleId").notEmpty()
];
exports.planIdParamValidation = [
    (0, express_validator_1.param)("planId").notEmpty()
];
