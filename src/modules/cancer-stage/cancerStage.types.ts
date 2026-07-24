export interface CreateCancerStageDto {

    stage_code: string;

    stage_name: string;

    stage_group?: string;

    description?: string;

}

export interface UpdateCancerStageDto {

    stage_code?: string;

    stage_name?: string;

    stage_group?: string;

    description?: string;

    is_active?: boolean;

}

export interface GetCancerStagesQuery {

    search?: string;

    stageGroup?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
