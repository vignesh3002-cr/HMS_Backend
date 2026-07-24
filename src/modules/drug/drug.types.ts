export interface CreateDrugDto {

    drug_code: string;

    drug_name: string;

    generic_name?: string;

    brand_name?: string;

    drug_class?: string;

    vesicant_status?: string;

    administration_route?: string;

    standard_unit?: string;

    max_dose_per_cycle?: number;

    storage_condition?: string;

    is_high_alert?: boolean;

    linked_medicine_id?: string;

}

export interface UpdateDrugDto {

    drug_code?: string;

    drug_name?: string;

    generic_name?: string;

    brand_name?: string;

    drug_class?: string;

    vesicant_status?: string;

    administration_route?: string;

    standard_unit?: string;

    max_dose_per_cycle?: number;

    storage_condition?: string;

    is_high_alert?: boolean;

    linked_medicine_id?: string;

    is_active?: boolean;

}

export interface GetDrugsQuery {

    search?: string;

    drugClass?: string;

    vesicantStatus?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
