export interface AvailableStaffQuery {
    branchId: string;
    dutyDate: string; // YYYY-MM-DD
    shiftCode: string; // MORNING, EVENING, NIGHT, GENERAL
    roleInDuty: "DUTY_DOCTOR" | "DUTY_NURSE";
    includeAllBranch?: boolean; // Emergency override
}

export interface AvailableStaffMember {
    employee_id: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    role_type: string;
    specialization: string | null;
    shift_code: string;
    source: "ROSTER" | "TEMPLATE" | "OVERRIDE";
    active_patients_count: number;
}

export interface CreateDutyRosterDTO {
    employee_id: string;
    branch_id: string;
    duty_date: string; // YYYY-MM-DD
    shift_code: string;
    start_time?: string; // HH:mm or HH:mm:ss (auto-resolved from branch_shift_master if omitted)
    end_time?: string;
    role_in_duty: "DUTY_DOCTOR" | "DUTY_NURSE";
    notes?: string;
}

export interface CreateDutyTemplateDTO {
    employee_id: string;
    branch_id: string;
    day_of_week: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
    shift_code: string;
    start_time?: string; // HH:mm or HH:mm:ss (auto-resolved from branch_shift_master if omitted)
    end_time?: string;
    role_in_duty: "DUTY_DOCTOR" | "DUTY_NURSE";
    effective_from?: string;
    effective_to?: string;
}

export interface UpdateBranchShiftDTO {
    shift_name?: string;
    start_time?: string;
    end_time?: string;
    is_overnight?: boolean;
    display_order?: number;
    is_active?: boolean;
}

export interface CreateBranchShiftDTO {
    branch_id: string;
    shift_code: string;
    shift_name: string;
    start_time: string;
    end_time: string;
    is_overnight?: boolean;
    display_order?: number;
}

