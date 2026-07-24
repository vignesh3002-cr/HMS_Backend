export interface CreateProtocolDto {

    protocol_code: string;

    protocol_name: string;

    cancer_type_id?: string;

    cancer_stage_id?: string;

    treatment_intent_id?: string;

    cycle_length_days?: number;

    total_recommended_cycles?: number;

    protocol_description?: string;

    reference_guideline?: string;

}

export interface UpdateProtocolDto {

    protocol_code?: string;

    protocol_name?: string;

    cancer_type_id?: string;

    cancer_stage_id?: string;

    treatment_intent_id?: string;

    cycle_length_days?: number;

    total_recommended_cycles?: number;

    protocol_description?: string;

    reference_guideline?: string;

    is_active?: boolean;

}

export interface GetProtocolsQuery {

    search?: string;

    cancerTypeId?: string;

    cancerStageId?: string;

    treatmentIntentId?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}

// ---- Protocol <-> Drug bridge (chemo_protocol_drug) ----

export interface AddProtocolDrugDto {

    drug_id: string;

    administration_day?: string;

    dose?: string;

    sequence_order?: number;

    infusion_duration?: string;

}

export interface UpdateProtocolDrugDto {

    administration_day?: string;

    dose?: string;

    sequence_order?: number;

    infusion_duration?: string;

    is_active?: boolean;

}
