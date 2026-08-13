export interface StagingInput {

    cancer_type: string; // cancer_types.cancer_type name, e.g. "Breast"
    clinical_stage?: string | null;
    t_stage?: string | null;
    n_stage?: string | null;
    m_stage?: string | null;
    metastasis_sites?: string[] | null;

}

export interface IhcInput {

    er_status?: string | null; // Positive | Negative | Not Done
    er_percent?: number | null;
    pr_status?: string | null;
    pr_percent?: number | null;
    her2_ihc?: string | null; // 0 | 1+ | 2+ | 3+ (with or without trailing label text)
    her2_fish?: string | null; // Amplified | Not Amplified | Pending | Not Done
    her2_fish_ratio?: number | null;
    her2_avg_copy?: number | null;
    ki67_percent?: number | null;
    pdl1_clone?: string | null;
    pdl1_tps?: number | null;
    pdl1_cps?: number | null;
    mmr_mlh1?: string | null; // Intact | Lost | Not Done
    mmr_msh2?: string | null;
    mmr_msh6?: string | null;
    mmr_pms2?: string | null;
    mmr_overall?: string | null; // dMMR | pMMR
    p53_ihc?: string | null;
    ar_status?: string | null;
    mlh1_methylation?: string | null; // Methylated | Not Methylated | Not Done

}

export interface MolecularInput {

    egfr_status?: string | null; // Mutation Detected | Not Detected | Pending | Not Done
    egfr_mutation_type?: string | null;
    alk_status?: string | null;
    ros1_status?: string | null;
    kras_g12c?: string | null;
    kras_mutation?: string | null;
    braf_v600e?: string | null;
    brca1_germline?: string | null; // Pathogenic | Likely Pathogenic | Variant of Uncertain Significance (VUS) | Negative | Not Done | Pending
    brca2_germline?: string | null;
    brca_somatic?: string | null;
    msi_status?: string | null;
    tmb?: number | null;

}

export interface RuleViolation {

    rule: string;
    field: string;
    message: string;

}

export interface ValidationResult {

    hardErrors: RuleViolation[];
    warnings: RuleViolation[];

}

export interface ClinicalParameters {

    er_pr_positivity_cutoff_pct: number;
    ki67_luminal_ab_cutoff_pct: number;
    her2_fish_ratio_cutoff: number;
    her2_fish_avg_copy_cutoff: number;
    pdl1_tps_low_cutoff_pct: number;
    pdl1_tps_high_cutoff_pct: number;
    tmb_high_cutoff: number;
    tnbc_germline_referral_age_years: number;

}

export interface DerivedOncologyFields {

    breast_mol_subtype: string | null;
    icd10_auto: string | null;
    icd_o3_auto: string | null;
    ajcc_stage: string | null;
    pdl1_score_type: string | null;
    her2_positive: boolean | null;
    lynch_syndrome_flag: boolean;
    germline_referral_flag: boolean;
    suggested_therapy: string | null;

}

// ---------------------------------------------------------------------------
// API request DTOs (Phase 4). Field names mirror the DB columns directly so
// mapping in oncology.service.ts is a straight pick - the exceptions are the
// ICD/staging-system auto-fill fields (icd10_code, icd_o3_topo, icd_o3_morpho,
// staging_system), which are never accepted from the client: they're always
// server-derived from the selected cancer_subtype/cancer_type (design guide
// Section 6 cascade), so they're deliberately absent from these DTOs.
// ---------------------------------------------------------------------------
export interface IhcUpsertDto {

    er_status?: string | null;
    er_percent?: number | null;
    pr_status?: string | null;
    pr_percent?: number | null;
    her2_ihc?: string | null;
    her2_fish?: string | null;
    her2_fish_ratio?: number | null;
    her2_avg_copy?: number | null;
    ki67_percent?: number | null;
    pdl1_tps?: number | null;
    pdl1_cps?: number | null;
    pdl1_clone?: string | null;
    mmr_mlh1?: string | null;
    mmr_msh2?: string | null;
    mmr_msh6?: string | null;
    mmr_pms2?: string | null;
    mmr_overall?: string | null;
    p53_ihc?: string | null;
    ar_status?: string | null;
    mlh1_methylation?: string | null;

}

export interface MolecularUpsertDto {

    egfr_status?: string | null;
    egfr_mutation_type?: string | null;
    alk_status?: string | null;
    alk_test_method?: string | null;
    ros1_status?: string | null;
    kras_g12c?: string | null;
    kras_mutation?: string | null;
    braf_v600e?: string | null;
    brca1_germline?: string | null;
    brca2_germline?: string | null;
    brca_somatic?: string | null;
    hrd_status?: string | null;
    hrd_score?: number | null;
    hrd_assay?: string | null;
    msi_status?: string | null;
    msi_test_method?: string | null;
    tmb?: number | null;
    tmb_assay?: string | null;
    ngs_panel?: string | null;
    flt3_itd?: string | null;
    flt3_itd_allelic_ratio?: number | null;
    flt3_tkd?: string | null;
    npm1_mutation?: string | null;
    idh1_mutation?: string | null;
    idh2_mutation?: string | null;
    bcr_abl1?: number | null;
    bcr_abl1_transcript?: string | null;

}

export interface CreateStagingDetailDto {

    patient_id: string;
    // Mandatory: an oncology diagnosis must be tied to a real diagnosis
    // catalog entry, and (per createStagingDetail's encounter check) the
    // patient must have an open/recent encounter for this to be recorded at all.
    diagnosis_id: string;
    patient_history_id?: string | null;
    visit_date?: string | null;
    diagnosis_date?: string | null;
    biopsy_date?: string | null;
    consulting_oncologist?: string | null;
    cancer_type_id: string;
    cancer_subtype_id: string;
    clinical_stage?: string | null;
    t_stage?: string | null;
    n_stage?: string | null;
    m_stage?: string | null;
    metastasis_sites?: string[] | null;
    laterality?: string | null;
    performance_status?: number | null;
    employee_id?: string | null;
    branch_id?: string | null;
    ihc?: IhcUpsertDto | null;
    molecular?: MolecularUpsertDto | null;

}

export interface UpdateStagingDetailDto {

    diagnosis_id?: string | null;
    patient_history_id?: string | null;
    visit_date?: string | null;
    diagnosis_date?: string | null;
    biopsy_date?: string | null;
    consulting_oncologist?: string | null;
    cancer_type_id?: string;
    cancer_subtype_id?: string;
    clinical_stage?: string | null;
    t_stage?: string | null;
    n_stage?: string | null;
    m_stage?: string | null;
    metastasis_sites?: string[] | null;
    laterality?: string | null;
    performance_status?: number | null;
    employee_id?: string | null;
    branch_id?: string | null;
    ihc?: IhcUpsertDto | null;
    molecular?: MolecularUpsertDto | null;

}

export interface StagingDetailFilterQuery {

    patient_id?: string;
    diagnosis_id?: string;
    employee_id?: string;
    branch_id?: string;
    cancer_type_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;

}
