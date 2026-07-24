export interface CreateTreatmentIntentDto {

    intent_code: string;

    intent_name: string;

    description?: string;

}

export interface UpdateTreatmentIntentDto {

    intent_code?: string;

    intent_name?: string;

    description?: string;

    is_active?: boolean;

}

export interface GetTreatmentIntentsQuery {

    search?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
