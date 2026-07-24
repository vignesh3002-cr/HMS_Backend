export interface CreateTnmStageDto {

    cancer_type_id?: string;

    t_category?: string;

    n_category?: string;

    m_category?: string;

    tnm_combined_code?: string;

    staging_edition?: string;

    overall_stage_group?: string;

    description?: string;

}

export interface UpdateTnmStageDto {

    cancer_type_id?: string;

    t_category?: string;

    n_category?: string;

    m_category?: string;

    tnm_combined_code?: string;

    staging_edition?: string;

    overall_stage_group?: string;

    description?: string;

    is_active?: boolean;

}

export interface GetTnmStagesQuery {

    search?: string;

    cancerTypeId?: string;

    overallStageGroup?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
