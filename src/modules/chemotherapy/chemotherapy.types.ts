export interface RegimenProtocolDilutionInput {

    protocol_dilution_id?: string;
    source_resource_id?: string | null;
    medicine_id?: string | null;
    form?: string | null;
    dose?: number | null;
    dose_unit?: string | null;
    dilution_volume?: number | null;
    dilution_volume_unit?: string | null;
    diluent?: string | null;
    comment?: string | null;
    active_status?: number | null;

}

export interface RegimenProtocolDischargeInstructionInput {

    discharge_instruction_id?: string;
    source_resource_id?: string | null;
    medicine_id?: string | null;
    drug_sequence?: number | null;
    drug_from?: string | null;
    frequency?: string | null;
    duration?: string | null;
    patient_dose?: number | null;
    patient_dose_unit?: string | null;
    administration_detail?: string | null;
    comment?: string | null;
    active_status?: number | null;

}

export interface RegimenProtocolItemDto {

    medicine_id: string;
    drug_role?: "PRIMARY" | "PREMEDICATION" | "POSTMEDICATION" | "SUPPORTIVE";
    drug_sequence: number;
    drug_type?: string | null;
    dosage?: number | null;
    dosage_unit?: string | null;
    dose_calculation_method?: string | null;
    administration_route?: string | null;
    infusion_type?: string | null;
    infusion_duration_minutes?: number | null;
    administration_day?: number | null;
    cycle_day?: number | null;
    frequency?: string | null;
    timing_relative_to_primary?: string | null;
    patient_dose?: number | null;
    patient_dose_unit?: string | null;
    administration_detail?: string | null;
    previous_toxicity?: string | null;
    remarks?: string | null;
    dilutions?: RegimenProtocolDilutionInput[];

}

export interface UpdateRegimenProtocolItemDto {
  medicine_id?: string;
  drug_role?: "PRIMARY" | "PREMEDICATION" | "POSTMEDICATION" | "SUPPORTIVE";
  drug_sequence?: number;
  drug_type?: string | null;
  dosage?: number | null;
  dosage_unit?: string | null;
  dose_calculation_method?: string | null;
  administration_route?: string | null;
  infusion_type?: string | null;
  infusion_duration_minutes?: number | null;
  administration_day?: number | null;
  cycle_day?: number | null;
  frequency?: string | null;
  timing_relative_to_primary?: string | null;
  patient_dose?: number | null;
  patient_dose_unit?: string | null;
  administration_detail?: string | null;
  previous_toxicity?: string | null;
  remarks?: string | null;
  dilutions?: RegimenProtocolDilutionInput[];
}
export interface CreateRegimenProtocolDto {

    regimen_code?: string;
    regimen_name: string;
    protocol_version?: string | null;
    cancer_type_id: string;
    subtype_id?: string | null;
    treatment_intent?: string | null;
    standard_cycles?: number | null;
    cycle_interval_days?: number | null;
    guideline_source?: string | null;
    notes?: string | null;
    no_of_days?: number | null;
    days?: RegimenProtocolDayInput[];
    items: RegimenProtocolItemDto[];
    discharge_instructions?: RegimenProtocolDischargeInstructionInput[];

}

export interface UpdateRegimenProtocolDto {

    regimen_name?: string;
    protocol_version?: string | null;
    treatment_intent?: string | null;
    standard_cycles?: number | null;
    cycle_interval_days?: number | null;
    guideline_source?: string | null;
    notes?: string | null;
    discharge_instructions?: RegimenProtocolDischargeInstructionInput[];
    no_of_days?: number | null;
    days?: RegimenProtocolDayInput[];

}

export interface RegimenProtocolFilterQuery {

    cancer_type_id?: string;
    subtype_id?: string;
    // Optional org scoping - when provided, the result includes that
    // organization's active personalized protocols alongside the globally
    // available generics. When omitted, only generics are returned.
    organization_id?: string;

}

// -------------------------------------------------------------------------
// Organization-specific personalized regimen protocols
//
// A personalized protocol is an independent chemotherapy_regimen_protocol
// row owned by exactly one organization (organization_id = hospital_id) with
// protocol_type = "PERSONALIZED". Its lineage back to the source generic
// protocol is tracked with:
//   - original_protocol  -> the ROOT generic protocol this lineage came from
//   - protocol_reference -> the immediate parent protocol_id (generic for the
//     first personalization, the previous version for later versions)
//   - protocol_version   -> "v1", "v2", ... (incremented per version)
// The full hierarchy (protocol -> days -> items -> dilutions) is cloned into
// fresh rows with new IDs; nothing is ever shared with the generic source.
// -------------------------------------------------------------------------

export interface PersonalizationDilutionInput {

    protocol_dilution_id?: string;
    medicine_id?: string | null;
    form?: string | null;
    dose?: number | null;
    dose_unit?: string | null;
    dilution_volume?: number | null;
    dilution_volume_unit?: string | null;
    diluent?: string | null;
    comment?: string | null;
    active_status?: 0 | 1;
    // Identifies the source dilution this one was cloned from (used to match
    // inherited values when the editor saves the full structure back).
    source_resource_id?: string | null;

}

export interface PersonalizationItemInput {

    protocol_item_id?: string;
    medicine_id: string;
    drug_role?: "PRIMARY" | "PREMEDICATION" | "POSTMEDICATION" | "SUPPORTIVE";
    drug_sequence: number;
    drug_type?: string | null;
    dosage?: number | null;
    dosage_unit?: string | null;
    dose_calculation_method?: string | null;
    administration_route?: string | null;
    infusion_type?: string | null;
    infusion_duration_minutes?: number | null;
    administration_day?: number | null;
    cycle_day?: number | null;
    frequency?: string | null;
    timing_relative_to_primary?: string | null;
    patient_dose?: number | null;
    patient_dose_unit?: string | null;
    administration_detail?: string | null;
    remarks?: string | null;
    drug_brand_name?: string | null;
    protocol_dose?: number | null;
    protocol_dose_unit?: string | null;
    protocol_dose_text?: string | null;
    active_status?: 0 | 1;
    // Identifies the source item this one was cloned from.
    source_resource_id?: string | null;
    dilutions?: PersonalizationDilutionInput[];

}

export interface PersonalizationDayInput {

    protocol_day_id?: string;
    day_number: number;
    day_sequence?: number | null;
    same_as_day_one?: boolean | null;
    active_status?: 0 | 1;
    // Identifies the source day this one was cloned from.
    source_day_resource_id?: string | null;

}

export interface RegimenProtocolDayInput {

    protocol_day_id?: string;
    day_number: number;
    day_sequence?: number | null;
    same_as_day_one?: boolean | null;
    active_status?: 0 | 1;
    // Identifies the source day this one was cloned from.
    source_day_resource_id?: string | null;

}

export interface PersonalizeRegimenProtocolDto {

    regimen_name?: string;
    treatment_intent?: string | null;
    standard_cycles?: number | null;
    cycle_interval_days?: number | null;
    guideline_source?: string | null;
    notes?: string | null;
    composition?: string | null;
    additional_notes?: string | null;
    no_of_days?: number | null;
    day_care_referred?: boolean | null;
    create_day_care_appointment?: boolean | null;
    protocol_version?: string | null;
    // Full editor payload. When omitted the source protocol's entire
    // active structure (days, items, dilutions) is cloned unchanged.
    days?: PersonalizationDayInput[];
    items?: PersonalizationItemInput[];

}

export interface UpdatePersonalizedProtocolDto extends PersonalizeRegimenProtocolDto { }

export interface AddPersonalizedProtocolItemDto extends PersonalizationItemInput { }

export interface UpdatePersonalizedProtocolItemDto extends Partial<PersonalizationItemInput> { }

export interface AddPersonalizedProtocolDayDto extends PersonalizationDayInput { }

export interface UpdatePersonalizedProtocolDayDto extends Partial<PersonalizationDayInput> { }

export interface AddPersonalizedProtocolDilutionDto extends PersonalizationDilutionInput { }

export interface UpdatePersonalizedProtocolDilutionDto extends Partial<PersonalizationDilutionInput> { }

export interface VersionPersonalizedProtocolDto {

    reason?: string | null;
    notes?: string | null;

}

export interface PlanItemInputDto {

    medicine_id: string;
    drug_role?: "PRIMARY" | "PREMEDICATION" | "POSTMEDICATION" | "SUPPORTIVE";
    drug_sequence: number;
    drug_type?: string | null;
    dosage?: number | null;
    dosage_unit?: string | null;
    dose_calculation_method?: string | null;
    calculated_dose?: number | null;
    administration_route?: string | null;
    formulation?: string | null;
    infusion_type?: string | null;
    infusion_duration_minutes?: number | null;
    infusion_rate?: string | null;
    dilution_solution?: string | null;
    dilution_volume?: string | null;
    administration_day?: number | null;
    cycle_day?: number | null;
    frequency?: string | null;
    maximum_dose?: number | null;
    minimum_dose?: number | null;
    dose_required?: boolean | null;
    remarks?: string | null;

}

// staging_detail_id is required at the API level (even though the DB column
// is nullable) - the confirm_suggested_therapy gate is meaningless without a
// staging detail to read the computed suggested_therapy from. See
// PLAN_CONFIRMATION_RULE in chemotherapy.constants.ts.
//
// patient_history_id is optional here even though the column is NOT NULL on
// chemotherapy_plan: almost no patients have a patient_history row yet (no
// intake module writes one), so the service resolves the patient's most
// recent one automatically, or creates a minimal one, when this is omitted.
// Pass it explicitly only if you already know which history record this
// plan should attach to.
//
// protocol_id is optional: if given, the service pre-fills planned_cycles /
// cycle_interval_days / plan_items from that protocol template, and any of
// those fields also present in this DTO override the protocol's defaults
// (per-item too - if plan_items is provided, it's used as-is instead of the
// protocol's items). This is purely a one-time copy at creation time -
// nothing here ever writes back to the protocol, and later edits to this
// plan or to the protocol never affect each other again.
export interface CreatePlanDto {

    patient_id: string;
    staging_detail_id: string;
    diagnosis_id: string;
    employee_id: string;
    department_id: string;
    branch_id: string;
    patient_history_id?: string | null;
    encounter_no?: string | null;
    appointment_id?: string | null;
    protocol_id?: string | null;
    // Optional when protocol_id is given (defaults to the protocol's own
    // regimen_name/regimen_code); required otherwise.
    regimen_name?: string;
    regimen_code?: string | null;
    protocol_name?: string | null;
    protocol_version?: string | null;
    treatment_goal?: string | null;
    treatment_intent?: string | null;
    ecog_status?: string | null;
    karnofsky_score?: number | null;
    planned_cycles?: number;
    cycle_interval_days?: number | null;
    treatment_start_date: string;
    expected_end_date?: string | null;
    consent_taken?: boolean | null;
    consent_date?: string | null;
    insurance_type?: string | null;
    remarks?: string | null;
    // The "never auto-treat" gate - must be explicitly true regardless of
    // whether a suggested_therapy was actually computed (it's null for every
    // cancer type outside Breast/Lung, which chemo.derivation.ts doesn't
    // cover yet - the gate is "clinician has reviewed and decided", not
    // "system produced an answer").
    confirm_suggested_therapy: boolean;
    plan_items?: PlanItemInputDto[];

}

export interface UpdatePlanDto {

    regimen_name?: string;
    regimen_code?: string | null;
    protocol_name?: string | null;
    protocol_version?: string | null;
    treatment_goal?: string | null;
    treatment_intent?: string | null;
    ecog_status?: string | null;
    karnofsky_score?: number | null;
    planned_cycles?: number;
    cycle_interval_days?: number | null;
    expected_end_date?: string | null;
    consent_taken?: boolean | null;
    consent_date?: string | null;
    insurance_type?: string | null;
    remarks?: string | null;

}

export interface PlanStatusChangeDto {

    status: string;
    reason?: string | null;

}

export interface PlanFilterQuery {

    patient_id?: string;
    diagnosis_id?: string;
    employee_id?: string;
    branch_id?: string;
    department_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;

}

export interface AddPlanItemDto extends PlanItemInputDto { }

export interface CreateCycleDto {

    cycle_number: number;
    cycle_day?: number | null;
    planned_date: string;
    cycle_interval_days?: number | null;

}

export interface UpdateCycleDto {

    planned_date?: string;
    treatment_delay?: boolean | null;
    delay_days?: number | null;
    delay_reason?: string | null;
    rescheduled_date?: string | null;
    remarks?: string | null;

}

export interface CycleStatusChangeDto {

    status: string;
    reason?: string | null;

}

export interface RecordAdministrationDto {

    chemotherapy_plan_item_id: string;
    administration_date: string;
    administration_start_time?: string | null;
    administration_end_time?: string | null;
    administered_dose?: number | null;
    administered_dose_unit?: string | null;
    administration_route?: string | null;
    infusion_rate?: string | null;
    infusion_duration_minutes?: number | null;
    infusion_completed?: boolean | null;
    administered_by?: string | null;
    verified_by?: string | null;
    iv_site?: string | null;
    iv_access_type?: string | null;
    cannula_size?: string | null;
    peripheral_line?: boolean | null;
    central_line?: boolean | null;
    picc_line?: boolean | null;
    port_used?: boolean | null;
    pump_used?: boolean | null;
    pump_serial_no?: string | null;
    oxygen_support?: boolean | null;
    steroid_given?: boolean | null;
    antihistamine_given?: boolean | null;
    antiemetic_given?: boolean | null;
    hydration_given?: boolean | null;
    emergency_medication_given?: boolean | null;
    treatment_stopped?: boolean | null;
    interruption_reason?: string | null;
    doctor_informed?: boolean | null;
    nursing_notes?: string | null;
    administration_status?: string | null;
    remarks?: string | null;

}

export interface RecordVitalsDto {

    vital_stage?: string | null;
    blood_pressure_systolic?: number | null;
    blood_pressure_diastolic?: number | null;
    pulse_rate?: number | null;
    respiratory_rate?: number | null;
    body_temperature?: number | null;
    spo2?: number | null;
    height?: number | null;
    weight?: number | null;
    body_surface_area?: number | null;
    bmi?: number | null;
    pain_score?: number | null;
    pain_location?: string | null;
    blood_sugar?: number | null;
    oxygen_support?: boolean | null;
    oxygen_flow_rate?: number | null;
    consciousness_level?: string | null;
    hydration_status?: string | null;
    recorded_by?: string | null;
    remarks?: string | null;

}

export interface RecordAdverseEventDto {

    event_date?: string | null;
    adverse_event_name: string;
    adverse_event_category?: string | null;
    nausea?: boolean | null;
    vomiting?: boolean | null;
    diarrhea?: boolean | null;
    constipation?: boolean | null;
    mucositis?: boolean | null;
    fever?: boolean | null;
    fatigue?: boolean | null;
    neuropathy?: boolean | null;
    alopecia?: boolean | null;
    skin_rash?: boolean | null;
    anemia?: boolean | null;
    neutropenia?: boolean | null;
    thrombocytopenia?: boolean | null;
    infection?: boolean | null;
    bleeding?: boolean | null;
    pain?: boolean | null;
    reaction_grade?: string | null;
    ctcae_grade?: string | null;
    severity?: string | null;
    reaction_description?: string | null;
    treatment_interrupted?: boolean | null;
    treatment_stopped?: boolean | null;
    hospitalization_required?: boolean | null;
    icu_required?: boolean | null;
    emergency_medication_given?: boolean | null;
    medication_given?: string | null;
    dose_modified?: boolean | null;
    dose_reduced?: boolean | null;
    reduction_percentage?: number | null;
    dose_delayed?: boolean | null;
    delay_days?: number | null;
    doctor_action?: string | null;
    nursing_action?: string | null;
    physician_id?: string | null;
    reported_by?: string | null;
    resolved?: boolean | null;
    resolution_date?: string | null;
    remarks?: string | null;

}

export interface RecordLabReviewDto {

    hemoglobin?: number | null;
    rbc?: number | null;
    wbc?: number | null;
    platelet_count?: number | null;
    neutrophil_count?: number | null;
    anc?: number | null;
    creatinine?: number | null;
    creatinine_clearance?: number | null;
    blood_urea?: number | null;
    sgot_ast?: number | null;
    sgpt_alt?: number | null;
    bilirubin?: number | null;
    alkaline_phosphatase?: number | null;
    albumin?: number | null;
    sodium?: number | null;
    potassium?: number | null;
    calcium?: number | null;
    magnesium?: number | null;
    chloride?: number | null;
    phosphorus?: number | null;
    uric_acid?: number | null;
    coagulation_profile?: string | null;
    urine_test_result?: string | null;
    pregnancy_test?: string | null;
    cbc_normal?: boolean | null;
    renal_function_ok?: boolean | null;
    liver_function_ok?: boolean | null;
    chemotherapy_fit?: boolean | null;
    reviewed_by?: string | null;
    review_notes?: string | null;

}

export interface RecordFollowupDto {

    followup_date: string;
    next_followup_date?: string | null;
    treatment_response?: string | null;
    recist_response?: string | null;
    disease_progression?: boolean | null;
    progression_date?: string | null;
    progression_details?: string | null;
    remission_status?: string | null;
    recurrence?: boolean | null;
    recurrence_date?: string | null;
    recurrence_site?: string | null;
    metastasis?: boolean | null;
    metastasis_site?: string | null;
    survival_status?: string | null;
    performance_status?: string | null;
    ongoing_symptoms?: string | null;
    late_toxicity?: string | null;
    supportive_care?: string | null;
    followup_notes?: string | null;
    physician_assessment?: string | null;
    physician_id?: string | null;

}
