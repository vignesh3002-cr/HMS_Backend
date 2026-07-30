import { WorkingHourDto } from "../employee/employee.types";

export interface InitiateTransferDto {

    new_branch_id: string;

    new_department_id?: string;

    effective_date: string; // YYYY-MM-DD

    transfer_reason: string;

    working_hours: WorkingHourDto[];

    consultation_minutes?: number;

}

export interface ConfirmTransferDto {

    transfer_id: string;

    action: "TRANSFER" | "RESCHEDULE" | "CANCEL";

    // TRANSFER
    replacement_employee_id?: string;
    replacement_branch_id?: string;

    // RESCHEDULE
    priority?: string;
    reason?: string;

    // CANCEL
    confirm?: boolean;
    notify_channels?: string[];

}

export interface RescheduleQueueActionDto {

    action: "ASSIGN" | "CONFIRM" | "CANCEL";

    // ASSIGN
    employee_id?: string;
    branch_id?: string;
    appointment_date?: string; // YYYY-MM-DD
    appointment_time?: string; // HH:mm

    reason?: string;

}

export interface EligibleReplacementDoctor {

    employee_id: string;

    name: string;

}

export interface GetRescheduleQueueQuery {

    branchId?: string;

    patientId?: string;

    status?: string;

    page?: number;

    limit?: number;

}
