export interface CreatePremedicationDto {

    premed_code: string;

    premed_name: string;

    premed_category?: string;

    standard_dose?: string;

    route?: string;

    timing_before_chemo_minutes?: number;

    linked_medicine_id?: string;

}

export interface UpdatePremedicationDto {

    premed_code?: string;

    premed_name?: string;

    premed_category?: string;

    standard_dose?: string;

    route?: string;

    timing_before_chemo_minutes?: number;

    linked_medicine_id?: string;

    is_active?: boolean;

}

export interface GetPremedicationsQuery {

    search?: string;

    category?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
