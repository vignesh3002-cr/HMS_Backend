export const IPD_STATUS = {
    PLANNED: "PLANNED",
    ADMITTED: "ADMITTED",
    DISCHARGED: "DISCHARGED",
    TRANSFERRED: "TRANSFERRED",
    CANCELLED: "CANCELLED",
} as const;

export const BED_STATUS = {
    AVAILABLE: "AVAILABLE",
    OCCUPIED: "OCCUPIED",
    MAINTENANCE: "MAINTENANCE",
} as const;

export const WARD_STATUS = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
} as const;

export const DAYCARE = "Daycare";

export interface CreateWardDTO {
    branch_id: string;
    ward_name: string;
    ward_type: string;
    total_beds: number;
    created_by?: string;
}

export interface UpdateWardDTO {
    ward_name?: string;
    ward_type?: string;
    total_beds?: number;
    active_status?: number;
    updated_by?: string;
}

export interface CreateBedDTO {
    ward_id: string;
    branch_id: string;
    bed_number: string;
    bed_type: string;
    status?: string;
    active_status?: number;
    created_by?: string;
}

export interface UpdateBedDTO {
    bed_number?: string;
    bed_type?: string;
    status?: string;
    active_status?: number;
    updated_by?: string;
}

export interface CreateAdmissionDTO {
    patient_id: string;
    appointment_id?: string;
    branch_id: string;
    department_id?: string;
    employee_id?: string;
    admission_type: string;
    ip_number?: string;
    ward_id?: string;
    bed_id?: string;
    is_daycare?: boolean;
    payment_mode?: string;
    insurance_provider?: string;
    insurance_policy_no?: string;
    expected_stay_days?: number;
    advance_amount?: number;
    provisional_diagnosis?: string;
    admission_date?: string | Date;
    status?: string;
    created_by?: string;
}

export interface UpdateAdmissionDTO {
    ward_id?: string;
    bed_id?: string;
    department_id?: string;
    employee_id?: string;
    admission_type?: string;
    payment_mode?: string;
    insurance_provider?: string;
    insurance_policy_no?: string;
    expected_stay_days?: number;
    advance_amount?: number;
    provisional_diagnosis?: string;
    is_daycare?: boolean;
    admission_date?: string | Date;
    discharge_date?: Date;
    discharge_type?: string;
    discharge_summary?: string;
    status?: string;
    updated_by?: string;
}

export interface AdmissionSearchQuery {
    branchId?: string;
    status?: string;
    patientId?: string;
    date?: string;
    page?: string;
    limit?: string;
    search?: string;
    sortField?: string;
    sortDirection?: string;
}
