export interface CreateIcdCodeDto {

    icd_code: string;

    icd_version?: string;

    icd_description: string;

    icd_category?: string;

}

export interface UpdateIcdCodeDto {

    icd_code?: string;

    icd_version?: string;

    icd_description?: string;

    icd_category?: string;

    is_active?: boolean;

}

export interface GetIcdCodesQuery {

    search?: string;

    icdVersion?: string;

    category?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
