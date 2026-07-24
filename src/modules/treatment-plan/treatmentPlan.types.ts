export interface CreateTreatmentPlanDto {

    diagnosis_id: string;

    patient_id: string;

    protocol_id?: string;

    treatment_intent_id?: string;

    branch_id?: string;

    department_id?: string;

    planning_doctor_id?: string;

    height_cm?: number;

    weight_kg?: number;

    body_surface_area?: number;

    ecog_performance_status?: string;

    planned_total_cycles?: number;

    cycle_interval_days?: number;

    planned_start_date?: string;

    clinical_summary?: string;

    remarks?: string;

}

export interface UpdateTreatmentPlanDto {

    protocol_id?: string;

    treatment_intent_id?: string;

    branch_id?: string;

    department_id?: string;

    planning_doctor_id?: string;

    height_cm?: number;

    weight_kg?: number;

    body_surface_area?: number;

    ecog_performance_status?: string;

    planned_total_cycles?: number;

    cycle_interval_days?: number;

    planned_start_date?: string;

    plan_status?: string;

    clinical_summary?: string;

    remarks?: string;

    is_active?: boolean;

}

export interface GetTreatmentPlansQuery {

    patientId?: string;

    diagnosisId?: string;

    protocolId?: string;

    planStatus?: string;

    branchId?: string;

    doctorId?: string;

    isActive?: string;

    search?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
