export type DoctorScheduleChangeMode =
    | "ADD"
    | "OVERRIDE"
    | "CANCEL";

export interface CreateDoctorScheduleChangePayload {
    employee_id: string;
    branch_id: string;
    change_date: string;
    mode: DoctorScheduleChangeMode;
    start_time?: string;
    end_time?: string;
    reason?: string;
    created_by?: string;
}

export interface UpdateDoctorScheduleChangePayload {
    change_date?: string;
    mode?: DoctorScheduleChangeMode;
    start_time?: string;
    end_time?: string;
    reason?: string;
    is_active?: boolean;
}

export interface ToggleRecurringSchedulePayload {
    employee_id: string;
    branch_id: string;
    day_of_week: string;
    is_active: boolean;
}

export interface CreateRecurringSlotPayload {
    employee_id: string;
    branch_id: string;
    day_of_week: string;
    shift_name?: string;
    start_time: string;
    end_time: string;
}

export interface RecurringScheduleResponse {
    schedule_id: bigint;
    employee_id: string;
    branch_id: string;
    day_of_week: string;
    shift_name: string | null;
    start_time: Date | null;
    end_time: Date | null;
    consultation_minutes: number | null;
    is_active: boolean;
    effective_from: Date | null;
    effective_to: Date | null;
}

export interface DoctorScheduleChangeResponse {
    change_id: bigint;
    employee_id: string;
    branch_id: string;
    change_date: Date;
    mode: DoctorScheduleChangeMode;
    start_time: Date | null;
    end_time: Date | null;
    reason: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: Date;
    updated_at: Date;
}