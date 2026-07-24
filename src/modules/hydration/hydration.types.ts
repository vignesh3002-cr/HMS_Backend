export interface CreateHydrationDto {

    hydration_code: string;

    fluid_name: string;

    fluid_type?: string;

    standard_volume_ml?: number;

    infusion_rate?: string;

    timing?: string;

    indication?: string;

    linked_medicine_id?: string;

}

export interface UpdateHydrationDto {

    hydration_code?: string;

    fluid_name?: string;

    fluid_type?: string;

    standard_volume_ml?: number;

    infusion_rate?: string;

    timing?: string;

    indication?: string;

    linked_medicine_id?: string;

    is_active?: boolean;

}

export interface GetHydrationsQuery {

    search?: string;

    timing?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
