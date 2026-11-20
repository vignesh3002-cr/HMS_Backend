// Shared types for the TNM staging module.
//
// The master tables are seeded from EMR_Master_IHC_Genomics_TNM.xlsx; these
// types describe the rows the derivation engine consumes, so the same code
// works for database rows, seeded JSON (verify script) and the HTTP layer.

export type StageAxis = "T" | "N" | "M" | "S";

// Clinical spelling used in the UI and stored on every record.
export type StageContext =
    | "CLINICAL"
    | "PATHOLOGICAL"
    | "YC"
    | "YP"
    | "RECURRENCE"
    | "AUTOPSY";

// Rules and categories are authored as "both" | "clinical" | "pathological".
export type ContextFamily = "clinical" | "pathological";

export const CONTEXT_VALUES: StageContext[] = [
    "CLINICAL",
    "PATHOLOGICAL",
    "YC",
    "YP",
    "RECURRENCE",
    "AUTOPSY",
];

export const CONTEXT_FAMILY: Record<StageContext, ContextFamily> = {
    CLINICAL: "clinical",
    PATHOLOGICAL: "pathological",
    YC: "clinical",
    YP: "pathological",
    RECURRENCE: "clinical",
    AUTOPSY: "pathological",
};

// Short prefix shown next to a stage: cT2 / pT2 / ycT2 / ypT2 / rT2 / aT2.
export const CONTEXT_PREFIX: Record<StageContext, string> = {
    CLINICAL: "c",
    PATHOLOGICAL: "p",
    YC: "yc",
    YP: "yp",
    RECURRENCE: "r",
    AUTOPSY: "a",
};

export const CONTEXT_LABEL: Record<StageContext, string> = {
    CLINICAL: "Clinical",
    PATHOLOGICAL: "Pathological",
    YC: "Post-neoadjuvant clinical",
    YP: "Post-neoadjuvant pathological",
    RECURRENCE: "Recurrence",
    AUTOPSY: "Autopsy",
};

export type StageCategoryRow = {
    schema_id: string;
    axis: StageAxis;
    shown_code: string;
    rule_code: string;
    context: string; // both | clinical | pathological
    definition: string | null;
    display_order: number | null;
};

export type ConditionGroup = {
    key: string;      // Age | PSA | GG | S | Grade | Site | Mitosis
    values: string[]; // accepted values (OR within the group)
};

export type StageRuleRow = {
    rule_id: string;
    schema_id: string;
    context: string; // both | clinical | pathological
    stage_group: string;
    t_codes: string[];
    n_codes: string[];
    m_codes: string[];
    conditions: ConditionGroup[];
    conditions_raw?: string | null;
    criteria_text: string | null;
    flag: string | null;
};

export type DirectStageRow = {
    schema_id: string;
    stage_code: string;
    definition: string | null;
    display_order: number | null;
    flag: string | null;
};

export type StagingCriterionRow = {
    criterion_key: string;
    label: string;
    input_type: "NUMBER" | "BAND" | "ENUM";
    options: string[];
    unit: string | null;
    source_module: string | null;
    display_order: number | null;
};

export type DeriveStatus = "MATCHED" | "NO_MATCH" | "AMBIGUOUS" | "INCOMPLETE";

export type DeriveResult = {
    status: DeriveStatus;
    mode: "TNM" | "DIRECT";
    derived_stage: string | null;
    rule_id: string | null;
    explanation: string | null;
    warnings: string[];
    /** Rule conditions still missing a value, so the form can prompt for them. */
    missing_conditions: string[];
};

export type DeriveRequest = {
    schemaId: string;
    context: StageContext;
    t?: string | null;
    n?: string | null;
    m?: string | null;
    s?: string | null;
    conditions?: Record<string, string | number | null | undefined>;
};

export type StageRecordInput = {
    staging_detail_id: string;
    diagnosis_id?: string | null;
    patient_id: string;
    cancer_type_id: string;
    schema_id: string;
    schema_role?: string;
    context: StageContext;
    t_code?: string | null;
    n_code?: string | null;
    m_code?: string | null;
    s_code?: string | null;
    t_display?: string | null;
    n_display?: string | null;
    m_display?: string | null;
    conditions?: Record<string, string | number | null | undefined>;
    modifiers?: Record<string, unknown>;
    final_stage?: string | null;
    is_overridden?: boolean;
    override_reason?: string | null;
    stage_date?: string | null;
    notes?: string | null;
};
