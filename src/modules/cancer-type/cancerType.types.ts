export interface CreateCancerTypeDto {

    cancer_type_code: string;

    cancer_type_name: string;

    cancer_category?: string;

    icd_o3_code?: string;

    description?: string;

}

export interface UpdateCancerTypeDto {

    cancer_type_code?: string;

    cancer_type_name?: string;

    cancer_category?: string;

    icd_o3_code?: string;

    description?: string;

    is_active?: boolean;

}

export interface GetCancerTypesQuery {

    search?: string;

    category?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
