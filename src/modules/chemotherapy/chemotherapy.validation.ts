import { body, param, query } from "express-validator";
import { PLAN_STATUS, CYCLE_STATUS, DRUG_ROLE } from "./chemotherapy.constants";

export const previewPlanValidation = [

    query("staging_detail_id").notEmpty().withMessage("staging_detail_id is required")

];

export const listRegimenProtocolsValidation = [

    query("cancer_type_id").optional().notEmpty(),
    query("subtype_id").optional().notEmpty(),
    // Comma-separated lists, e.g. cancer_type_ids=CT021,CT020
    query("cancer_type_ids").optional().isString(),
    query("subtype_ids").optional().isString()

];

export const getRegimenProtocolValidation = [

    param("protocolId").notEmpty()

];

export const createRegimenProtocolValidation = [

    // regimen_code is optional on create - it is auto-generated to match the
    // freshly generated protocol_id (protocol_id == regimen_code).
    body("regimen_code").optional({ nullable: true }),
    body("regimen_name").notEmpty().withMessage("regimen_name is required"),
    body("cancer_type_id").optional({ nullable: true }),
    body("cancer_type_ids").optional({ nullable: true }).isArray(),
    body("subtype_ids").optional({ nullable: true }).isArray(),
    body().custom((value) => {
        if (!value.cancer_type_id && (!value.cancer_type_ids || value.cancer_type_ids.length === 0)) {
            throw new Error("cancer_type_id or cancer_type_ids is required");
        }
        return true;
    }),
    body("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    body("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("no_of_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("days").optional({ nullable: true }).isArray(),
    body("days.*.day_number").isInt({ min: 1 }).withMessage("Each day requires a day_number >= 1"),
    body("days.*.protocol_day_id").optional().notEmpty(),
    body("days.*.day_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    body("days.*.same_as_day_one").optional({ nullable: true }).isBoolean(),
    body("days.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 }),
    body("items").isArray({ min: 1 }).withMessage("At least one protocol item (drug) is required"),
    body("items.*.medicine_id").notEmpty().withMessage("Each protocol item requires a medicine_id"),
    body("items.*.drug_sequence").isInt({ min: 1 }).withMessage("Each protocol item requires a drug_sequence >= 1"),
    body("items.*.drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
    body("dilutions").optional({ nullable: true }).isArray(),
    body("discharge_instructions").optional({ nullable: true }).isArray()

];

export const updateRegimenProtocolValidation = [

    param("protocolId").notEmpty(),
    body("regimen_name").optional().notEmpty(),
    body("cancer_type_id").optional({ nullable: true }),
    body("cancer_type_ids").optional({ nullable: true }).isArray(),
    body("subtype_id").optional({ nullable: true }),
    body("subtype_ids").optional({ nullable: true }).isArray(),
    body("treatment_intent").optional({ nullable: true }),
    body("guideline_source").optional({ nullable: true }),
    body("notes").optional({ nullable: true }),
    body("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    body("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("no_of_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("days").optional({ nullable: true }).isArray(),
    body("days.*.day_number").optional().isInt({ min: 1 }),
    body("days.*.protocol_day_id").optional().notEmpty(),
    body("days.*.day_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    body("days.*.same_as_day_one").optional({ nullable: true }).isBoolean(),
    body("days.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 }),
    body("dilutions").optional({ nullable: true }).isArray(),
    body("discharge_instructions").optional({ nullable: true }).isArray()

];

// ---------------- Personalized regimen protocols ----------------

export const protocolIdParamValidation = [

    param("protocolId").notEmpty()

];

export const personalizeRegimenProtocolValidation = [

    param("protocolId").notEmpty(),
    body("regimen_name").optional().notEmpty(),
    body("treatment_intent").optional({ nullable: true }).notEmpty(),
    body("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    body("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("guideline_source").optional({ nullable: true }).notEmpty(),
    body("notes").optional({ nullable: true }).notEmpty(),
    body("composition").optional({ nullable: true }).notEmpty(),
    body("additional_notes").optional({ nullable: true }).notEmpty(),
    body("no_of_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("day_care_referred").optional({ nullable: true }).isBoolean(),
    body("create_day_care_appointment").optional({ nullable: true }).isBoolean(),
    body("protocol_version").optional({ nullable: true }).notEmpty(),
    body("days").optional({ nullable: true }).isArray(),
    body("days.*.protocol_day_id").optional().notEmpty(),
    body("days.*.day_number").isInt({ min: 1 }).withMessage("Each day requires a day_number >= 1"),
    body("days.*.day_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    body("days.*.same_as_day_one").optional({ nullable: true }).isBoolean(),
    body("days.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 }),
    body("items").optional({ nullable: true }).isArray(),
    body("items.*.protocol_item_id").optional().notEmpty(),
    body("items.*.medicine_id").notEmpty().withMessage("Each item requires a medicine_id"),
    body("items.*.drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
    body("items.*.drug_sequence").isInt({ min: 1 }).withMessage("Each item requires a drug_sequence >= 1"),
    body("items.*.dosage").optional({ nullable: true }).isFloat({ min: 0 }),
    body("items.*.infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 }),
    body("items.*.administration_day").optional({ nullable: true }).isInt({ min: 1 }),
    body("items.*.cycle_day").optional({ nullable: true }).isInt({ min: 1 }),
    body("items.*.protocol_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("items.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 }),
    body("items.*.dilutions").optional({ nullable: true }).isArray(),
    body("items.*.dilutions.*.medicine_id").optional({ nullable: true }).notEmpty(),
    body("items.*.dilutions.*.dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("items.*.dilutions.*.dilution_volume").optional({ nullable: true }).isFloat({ min: 0 }),
    body("items.*.dilutions.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const updatePersonalizedProtocolValidation = [

    param("protocolId").notEmpty(),
    body("regimen_name").optional().notEmpty(),
    body("treatment_intent").optional({ nullable: true }).notEmpty(),
    body("standard_cycles").optional({ nullable: true }).isInt({ min: 1 }),
    body("cycle_interval_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("guideline_source").optional({ nullable: true }).notEmpty(),
    body("notes").optional({ nullable: true }).notEmpty(),
    body("composition").optional({ nullable: true }).notEmpty(),
    body("additional_notes").optional({ nullable: true }).notEmpty(),
    body("no_of_days").optional({ nullable: true }).isInt({ min: 1 }),
    body("day_care_referred").optional({ nullable: true }).isBoolean(),
    body("create_day_care_appointment").optional({ nullable: true }).isBoolean(),
    body("protocol_version").optional({ nullable: true }).notEmpty()

];

export const addPersonalizedProtocolItemValidation = [

    param("protocolId").notEmpty(),
    body("medicine_id").notEmpty().withMessage("medicine_id is required"),
    body("drug_sequence").isInt({ min: 1 }).withMessage("drug_sequence must be at least 1"),
    body("drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
    body("dosage").optional({ nullable: true }).isFloat({ min: 0 }),
    body("infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 }),
    body("administration_day").optional({ nullable: true }).isInt({ min: 1 }),
    body("cycle_day").optional({ nullable: true }).isInt({ min: 1 }),
    body("protocol_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const updatePersonalizedProtocolItemValidation = [

    param("protocolId").notEmpty(),
    param("protocolItemId").notEmpty(),
    body("medicine_id").optional().notEmpty(),
    body("drug_sequence").optional().isInt({ min: 1 }),
    body("drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
    body("dosage").optional({ nullable: true }).isFloat({ min: 0 }),
    body("infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 }),
    body("administration_day").optional({ nullable: true }).isInt({ min: 1 }),
    body("cycle_day").optional({ nullable: true }).isInt({ min: 1 }),
    body("protocol_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const removePersonalizedProtocolItemValidation = [

    param("protocolId").notEmpty(),
    param("protocolItemId").notEmpty()

];

export const addPersonalizedProtocolDayValidation = [

    param("protocolId").notEmpty(),
    body("day_number").isInt({ min: 1 }).withMessage("day_number must be at least 1"),
    body("day_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    body("same_as_day_one").optional({ nullable: true }).isBoolean(),
    body("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const updatePersonalizedProtocolDayValidation = [

    param("protocolId").notEmpty(),
    param("protocolDayId").notEmpty(),
    body("day_number").optional().isInt({ min: 1 }),
    body("day_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    body("same_as_day_one").optional({ nullable: true }).isBoolean(),
    body("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const removePersonalizedProtocolDayValidation = [

    param("protocolId").notEmpty(),
    param("protocolDayId").notEmpty()

];

export const addPersonalizedProtocolDilutionValidation = [

    param("protocolId").notEmpty(),
    param("protocolItemId").notEmpty(),
    body("medicine_id").optional({ nullable: true }).notEmpty(),
    body("drug_brand_name").optional({ nullable: true }).isString(),
    body("dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dilution_volume").optional({ nullable: true }).isFloat({ min: 0 }),
    body("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const updatePersonalizedProtocolDilutionValidation = [

    param("protocolId").notEmpty(),
    param("protocolItemId").notEmpty(),
    param("protocolDilutionId").notEmpty(),
    body("medicine_id").optional({ nullable: true }).notEmpty(),
    body("drug_brand_name").optional({ nullable: true }).isString(),
    body("dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dilution_volume").optional({ nullable: true }).isFloat({ min: 0 }),
    body("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const removePersonalizedProtocolDilutionValidation = [

    param("protocolId").notEmpty(),
    param("protocolItemId").notEmpty(),
    param("protocolDilutionId").notEmpty()

];

export const createPersonalizedProtocolVersionValidation = [

    param("protocolId").notEmpty(),
    body("reason").optional({ nullable: true }).notEmpty(),
    body("notes").optional({ nullable: true }).notEmpty()

];

export const addRegimenProtocolItemValidation = [

    param("protocolId").notEmpty(),
    body("medicine_id").notEmpty().withMessage("medicine_id is required"),
    body("drug_brand_name").optional({ nullable: true }).isString(),
    body("drug_sequence").isInt({ min: 1 }).withMessage("drug_sequence must be at least 1"),
    body("drug_role").optional({ nullable: true }).isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
    body("dilutions").optional({ nullable: true }).isArray(),
    body("dilutions.*.protocol_dilution_id").optional({ nullable: true }).notEmpty(),
    body("dilutions.*.medicine_id").optional({ nullable: true }).notEmpty(),
    body("dilutions.*.drug_brand_name").optional({ nullable: true }).isString(),
    body("dilutions.*.form").optional({ nullable: true }).isString(),
    body("dilutions.*.dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dilutions.*.dose_unit").optional({ nullable: true }).isString(),
    body("dilutions.*.dilution_volume").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dilutions.*.dilution_volume_unit").optional({ nullable: true }).isString(),
    body("dilutions.*.diluent").optional({ nullable: true }).isString(),
    body("dilutions.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const addDischargeInstructionValidation = [

    param("protocolId").notEmpty(),
    body("medicine_id").optional({ nullable: true }).notEmpty(),
    body("drug_brand_name").optional({ nullable: true }).isString(),
    body("drug_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    body("drug_from").optional({ nullable: true }).isString(),
    body("frequency").optional({ nullable: true }).isString(),
    body("duration").optional({ nullable: true }).isString(),
    body("duration_days").optional({ nullable: true }).isString(),
    body("patient_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("patient_dose_unit").optional({ nullable: true }).isString(),
    body("administration_detail").optional({ nullable: true }).isString(),
    body("comment").optional({ nullable: true }).isString(),
    body("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const updateDischargeInstructionValidation = [

    param("protocolId").notEmpty(),
    param("dischargeInstructionId").notEmpty(),
    body("medicine_id").optional({ nullable: true }).notEmpty(),
    body("drug_brand_name").optional({ nullable: true }).isString(),
    body("drug_sequence").optional({ nullable: true }).isInt({ min: 1 }),
    body("drug_from").optional({ nullable: true }).isString(),
    body("frequency").optional({ nullable: true }).isString(),
    body("duration").optional({ nullable: true }).isString(),
    body("duration_days").optional({ nullable: true }).isString(),
    body("patient_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("patient_dose_unit").optional({ nullable: true }).isString(),
    body("administration_detail").optional({ nullable: true }).isString(),
    body("comment").optional({ nullable: true }).isString(),
    body("active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 })

];

export const removeDischargeInstructionValidation = [

    param("protocolId").notEmpty(),
    param("dischargeInstructionId").notEmpty()

];

export const updateRegimenProtocolItemValidation = [
  param("protocolId").notEmpty(),
  param("protocolItemId").notEmpty(),
  body("medicine_id").optional({ nullable: true }).notEmpty(),
  body("drug_brand_name").optional({ nullable: true }).isString(),
  body("drug_role").optional({ nullable: true }).isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
  body("drug_sequence").optional({ nullable: true }).isInt({ min: 1 }),
  body("drug_type").optional({ nullable: true }).isString(),
  body("dosage").optional({ nullable: true }).isFloat({ min: 0 }),
  body("dosage_unit").optional({ nullable: true }).isString(),
  body("dose_calculation_method").optional({ nullable: true }).isString(),
  body("administration_route").optional({ nullable: true }).isString(),
  body("infusion_type").optional({ nullable: true }).isString(),
  body("infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 }),
  body("administration_day").optional({ nullable: true }).isInt({ min: 1 }),
  body("cycle_day").optional({ nullable: true }).isInt({ min: 1 }),
  body("frequency").optional({ nullable: true }).isString(),
  body("timing_relative_to_primary").optional({ nullable: true }).isString(),
  body("patient_dose").optional({ nullable: true }).isFloat({ min: 0 }),
  body("patient_dose_unit").optional({ nullable: true }).isString(),
  body("administration_detail").optional({ nullable: true }).isString(),
  body("previous_toxicity").optional({ nullable: true }).isString(),
  body("remarks").optional({ nullable: true }).isString(),
  body("dilutions").optional({ nullable: true }).isArray(),
  body("dilutions.*.protocol_dilution_id").optional({ nullable: true }).notEmpty(),
  body("dilutions.*.medicine_id").optional({ nullable: true }).notEmpty(),
  body("dilutions.*.drug_brand_name").optional({ nullable: true }).isString(),
  body("dilutions.*.form").optional({ nullable: true }).isString(),
  body("dilutions.*.dose").optional({ nullable: true }).isFloat({ min: 0 }),
  body("dilutions.*.dose_unit").optional({ nullable: true }).isString(),
  body("dilutions.*.dilution_volume").optional({ nullable: true }).isFloat({ min: 0 }),
  body("dilutions.*.dilution_volume_unit").optional({ nullable: true }).isString(),
  body("dilutions.*.diluent").optional({ nullable: true }).isString(),
  body("dilutions.*.active_status").optional({ nullable: true }).isInt({ min: 0, max: 1 }),
];
export const createPlanValidation = [

    body("patient_id").notEmpty().withMessage("patient_id is required"),
    body("staging_detail_id").notEmpty().withMessage("staging_detail_id is required"),
   /* body("diagnosis_id").notEmpty().withMessage("diagnosis_id is required"),*/    
    body("employee_id").notEmpty().withMessage("employee_id is required"),
    body("department_id").notEmpty().withMessage("department_id is required"),
    body("branch_id").notEmpty().withMessage("branch_id is required"),
    // appointment_id and encounter_no are optional but allowed
    body("appointment_id").optional({ nullable: true }).notEmpty(),
    body("encounter_no").optional({ nullable: true }).notEmpty(),
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
    ...drugIdentityRules("plan_items.*."),
    body("plan_items.*.drug_sequence").isInt({ min: 1 }).withMessage("Each plan item requires a drug_sequence >= 1"),
    body("plan_items.*.drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
    body("plan_items.*.calculated_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("plan_items.*.calculated_dose_unit").optional({ nullable: true }).isString(),
    body("plan_items.*.dose_calculation_method").optional({ nullable: true }).isString(),
    body("dosing_height_cm").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing_weight_kg").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing_bsa").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing_serum_creatinine").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing_crcl").optional({ nullable: true }).isFloat({ min: 0 }),
    body("remarks").optional({ nullable: true }).isString(),
    body("discussion").optional({ nullable: true }).isString()

];

export const updatePlanValidation = [

    param("planId").notEmpty(),
    body("source_protocol_id").optional({ nullable: true }).isString(),
    body("staging_detail_id").optional({ nullable: true }).isString(),
    body("planned_cycles").optional().isInt({ min: 1 }),
    body("expected_end_date").optional({ nullable: true }).isISO8601(),
    body("consent_date").optional({ nullable: true }).isISO8601(),
    body("dosing_height_cm").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing_weight_kg").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing_bsa").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing_serum_creatinine").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing_crcl").optional({ nullable: true }).isFloat({ min: 0 }),
    body("remarks").optional({ nullable: true }).isString(),
    body("discussion").optional({ nullable: true }).isString()

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

// Columns every Chemotherapy Order row can edit.
// A drug is a medicine from the list (medicine_id) or a name typed for
// this patient (drug_name, never added to medicine_master).
function drugIdentityRules(prefix: string) {

    const itemPath = prefix.endsWith(".") ? prefix.slice(0, -1) : prefix;

    return [
        body(`${prefix}medicine_id`).optional({ nullable: true }).isString(),
        body(`${prefix}drug_name`).optional({ nullable: true }).isString().isLength({ max: 200 }).withMessage("Drug name must be at most 200 characters"),
        (itemPath ? body(itemPath) : body())
            .custom((item) => Boolean(item?.medicine_id) || Boolean(String(item?.drug_name ?? "").trim()))
            .withMessage("Each drug needs a medicine from the list or a typed drug name")
    ];

}

// The editable columns of a list of plan item rows (prefix "items.*.").
function planItemListRules(prefix: string) {

    return [
        ...drugIdentityRules(prefix),
        body(`${prefix}drug_sequence`).isInt({ min: 1 }).withMessage("Each plan item requires a drug_sequence >= 1"),
        body(`${prefix}drug_role`).optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
        body(`${prefix}dosage`).optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Dose must be a number"),
        body(`${prefix}calculated_dose`).optional({ nullable: true }).isFloat({ min: 0 }),
        body(`${prefix}infusion_duration_minutes`).optional({ nullable: true }).isInt({ min: 0 }).withMessage("Infusion duration must be whole minutes"),
        body(`${prefix}administration_day`).optional({ nullable: true }).isInt({ min: 1 }),
        body(`${prefix}formulation`).optional({ nullable: true }).isString().isLength({ max: 100 }),
        body(`${prefix}administration_route`).optional({ nullable: true }).isString().isLength({ max: 100 }),
        body(`${prefix}infusion_type`).optional({ nullable: true }).isString().isLength({ max: 100 }),
        body(`${prefix}frequency`).optional({ nullable: true }).isString().isLength({ max: 100 }),
        body(`${prefix}timing_relative_to_primary`).optional({ nullable: true }).isString().isLength({ max: 100 }),
        body(`${prefix}duration`).optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage("Duration must be at most 100 characters")
    ];

}

function hydrationRowRules(prefix: string) {

    return [
        body(`${prefix}hydration_stage`).isIn(["PRE", "POST"]).withMessage("Hydration stage must be PRE or POST"),
        body(`${prefix}agent_name`).optional({ nullable: true }).isString().isLength({ max: 200 }),
        body(`${prefix}diluent`).optional({ nullable: true }).isString().isLength({ max: 200 }),
        body(`${prefix}dilution_volume`).optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Hydration volume must be a number"),
        body(`${prefix}dilution_volume_unit`).optional({ nullable: true }).isString().isLength({ max: 50 }),
        body(`${prefix}guidance`).optional({ nullable: true }).isString(),
        body(`${prefix}source_dilution_id`).optional({ nullable: true }).isString()
    ];

}

const planItemRowRules = [
    body("infusion_duration_minutes").optional({ nullable: true }).isInt({ min: 0 }).withMessage("Infusion duration must be whole minutes"),
    body("administration_day").optional({ nullable: true }).isInt({ min: 1 }),
    body("formulation").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("administration_route").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("infusion_type").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("frequency").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("timing_relative_to_primary").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("administration_detail").optional({ nullable: true }).isString(),
    body("remarks").optional({ nullable: true }).isString()
];

// Discharge (take-home) rows. drug_role is not accepted from the body: the
// endpoint always stores the row as DISCHARGE on this patient's plan.
export const addPlanDischargeMedicineValidation = [

    param("planId").notEmpty(),
    ...drugIdentityRules(""),
    body("drug_sequence").isInt({ min: 1 }).withMessage("A discharge medicine requires a drug_sequence >= 1"),
    body("drug_type").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("dosage").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Dose must be a number"),
    body("dosage_unit").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("frequency").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("administration_detail").optional({ nullable: true }).isString(),
    body("duration").optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage("Duration must be at most 100 characters"),
    body("remarks").optional({ nullable: true }).isString()

];

// Every field is optional, but drug_sequence still has to be a whole number
// >= 1 when it is sent.
export const updatePlanDischargeMedicineValidation = [

    param("planId").notEmpty(),
    param("planItemId").notEmpty(),
    /* No whole-body drug check here: a partial edit may send only a dosage,
       so the service rejects a drug change that leaves the row with neither
       a medicine nor a name. */
    body("medicine_id").optional({ nullable: true }).isString(),
    body("drug_name").optional({ nullable: true }).isString().isLength({ max: 200 }).withMessage("Drug name must be at most 200 characters"),
    body("drug_sequence").optional().isInt({ min: 1 }),
    body("drug_type").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("dosage").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Dose must be a number"),
    body("dosage_unit").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("frequency").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("administration_detail").optional({ nullable: true }).isString(),
    body("duration").optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage("Duration must be at most 100 characters"),
    body("remarks").optional({ nullable: true }).isString()

];

export const planDischargeParamValidation = [

    param("planId").notEmpty()

];

export const planDischargeItemParamValidation = [

    param("planId").notEmpty(),
    param("planItemId").notEmpty()

];

export const replacePlanItemsValidation = [

    param("planId").notEmpty(),
    body("items").isArray().withMessage("items must be an array"),
    ...planItemListRules("items.*.")

];

// PUT /plans/:planId/orders/:cycleNumber/:cycleDay - one cycle day's full
// order. hydration is optional: left out, that day's hydration is kept.
export const planOrderParamValidation = [

    param("planId").notEmpty(),
    param("cycleNumber").isInt({ min: 1 }).withMessage("Cycle must be at least 1"),
    param("cycleDay").isInt({ min: 1 }).withMessage("Day must be at least 1")

];

export const savePlanOrderValidation = [

    ...planOrderParamValidation,
    body("items").isArray().withMessage("items must be an array"),
    ...planItemListRules("items.*."),
    body("hydration").optional({ nullable: true }).isArray().withMessage("hydration must be an array"),
    ...hydrationRowRules("hydration.*."),
    body("dosing").optional({ nullable: true }).isObject(),
    body("dosing.height_cm").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing.weight_kg").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing.bsa").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing.serum_creatinine").optional({ nullable: true }).isFloat({ min: 0 }),
    body("dosing.crcl").optional({ nullable: true }).isFloat({ min: 0 }),
    body("encounter_no").optional({ nullable: true }).isString().isLength({ max: 100 }),
    body("copied_from_order_id").optional({ nullable: true }).isString().isLength({ max: 100 })

];

export const completePlanOrdersValidation = [

    param("planId").notEmpty(),
    body("encounter_no").isString().notEmpty().withMessage("encounter_no is required")

];

export const planHydrationValidation = [

    param("planId").notEmpty(),
    body("rows").isArray().withMessage("rows must be an array"),
    ...hydrationRowRules("rows.*.")

];

export const addPlanItemValidation = [

    param("planId").notEmpty(),
    ...drugIdentityRules(""),
    body("drug_sequence").isInt({ min: 1 }).withMessage("drug_sequence must be at least 1"),
    body("drug_role").optional().isIn(Object.values(DRUG_ROLE)).withMessage(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`),
    body("calculated_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("calculated_dose_unit").optional({ nullable: true }).isString(),
    body("dose_calculation_method").optional({ nullable: true }).isString(),
    ...planItemRowRules

];

export const updatePlanItemValidation = [

    param("planId").notEmpty(),
    param("planItemId").notEmpty(),
    body("medicine_id").optional({ nullable: true }).isString().notEmpty().withMessage("medicine_id cannot be blank"),
    body("drug_name").optional({ nullable: true }).isString().isLength({ max: 200 }).withMessage("Drug name must be at most 200 characters"),
    body("drug_sequence").optional().isInt({ min: 1 }),
    ...planItemRowRules,
    body("calculated_dose").optional({ nullable: true }).isFloat({ min: 0 }),
    body("calculated_dose_unit").optional({ nullable: true }).isString(),
    body("dose_calculation_method").optional({ nullable: true }).isString()

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
