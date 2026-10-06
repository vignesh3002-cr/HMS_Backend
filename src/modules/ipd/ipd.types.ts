export const IPD_STATUS = {
    PLANNED: "PLANNED",
    ADMITTED: "ADMITTED",
    DISCHARGED: "DISCHARGED",
    TRANSFERRED: "TRANSFERRED",
    CANCELLED: "CANCELLED",
    // A planned request that was never admitted (marked by staff, or by the
    // IPD bed job once the planned day plus a grace day has passed).
    NO_SHOW: "NO_SHOW",
} as const;

// AVAILABLE -> RESERVED (held for one planned admission, expires) -> OCCUPIED
// -> CLEANING (after discharge / transfer-out) -> AVAILABLE. MAINTENANCE takes
// a bed out of service.
export const BED_STATUS = {
    AVAILABLE: "AVAILABLE",
    RESERVED: "RESERVED",
    OCCUPIED: "OCCUPIED",
    CLEANING: "CLEANING",
    MAINTENANCE: "MAINTENANCE",
} as const;

export const WARD_STATUS = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
} as const;

export const DAYCARE = "Daycare";

/*
 * A daycare booking: the doctor's OPD slot (appointment_date + _time, IST)
 * plus a PLANNED daycare admission in a required ward. The bed is optional --
 * staff pick it close to the day. expected_stay_days is the session length
 * (days + hours/24), more than 0 and at most 1.
 */
export interface DaycareBookingDTO {
    patient_id: string;
    branch_id: string;
    department_id: string;
    employee_id: string;
    appointment_date: string; // yyyy-MM-dd (IST)
    appointment_time: string; // HH:mm (IST)
    ward_id: string;
    bed_id?: string;
    expected_stay_days: number;
    payment_mode?: string;
    advance_amount?: number;
    provisional_diagnosis?: string;
    reason_for_visit?: string;
}

/** The authenticated user acting on an admission (req.user). */
export interface IpdActor {
    user_id: string;
    role?: string;
}

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
    floor?: string;
    tariff?: number;
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
    tariff?: number;
    ward_id?: string;
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
