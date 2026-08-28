import { LEAVE_STATUS } from "./doctorLeave.constants";

export interface ApplyDoctorLeaveDto {
    leave_start_date: string;
    leave_end_date: string;
    leave_reason: string;
    replacement_employee_id?: string;
    leave_type?: string;
}

export interface ApproveDoctorLeaveDto {
    remarks?: string;
}

export interface RejectDoctorLeaveDto {
    remarks: string;
}

export interface QueueRescheduleDto {
    date_from: string;
    date_to: string;
    reason?: string;
    priority?: "LOW" | "NORMAL" | "HIGH";
}

export interface GetDoctorLeaveQuery {
    employee_id?: string;
    status?: typeof LEAVE_STATUS[keyof typeof LEAVE_STATUS];
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
}

export interface DoctorLeaveResponse {
    leave_id: string;
    employee_id: string;
    replacement_employee_id?: string | null;
    leave_start_date: string;
    leave_end_date: string;
    leave_reason: string;
    leave_type?: string | null;
    status: typeof LEAVE_STATUS[keyof typeof LEAVE_STATUS];
    requested_by: string;
    requested_at: Date;
    approved_by?: string | null;
    approved_at?: Date | null;
    rejected_by?: string | null;
    rejected_at?: Date | null;
    remarks?: string | null;
}