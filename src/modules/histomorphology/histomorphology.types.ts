export interface CreateHistomorphologyDto {

    morphology_code: string;

    morphology_name: string;

    behavior?: string;

    description?: string;

}

export interface UpdateHistomorphologyDto {

    morphology_code?: string;

    morphology_name?: string;

    behavior?: string;

    description?: string;

    is_active?: boolean;

}

export interface GetHistomorphologiesQuery {

    search?: string;

    behavior?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
