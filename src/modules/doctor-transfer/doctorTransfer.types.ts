import { WorkingHourDto } from "../employee/employee.types";

export interface InitiateTransferDto {

    // "TRANSFER"  -> doctor LEAVES the source branch: the old mapping is
    //                deactivated (status 0) and its schedules closed, the
    //                new one is activated/created (status 1).
    // "ADD_BRANCH"-> doctor keeps every existing active assignment and gains
    //                another active one — no source branch is closed.
    mode: "TRANSFER" | "ADD_BRANCH";

    // Required when mode === "TRANSFER" — the branch the doctor is leaving.
    // Must be one of the doctor's ACTIVE user_branch_mapping rows; "None" is
    // not a valid transfer source.
    old_branch_id?: string;

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

    // The branch the doctor is leaving — carried through from the initiate
    // step so the pending-confirmation path can close the source mapping
    // and its schedules when the transfer is finally confirmed.
    old_branch_id?: string;

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
