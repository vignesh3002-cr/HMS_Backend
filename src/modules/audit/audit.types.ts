export const AUDIT_ACTION = {
    CREATE: "CREATE",
    UPDATE: "UPDATE",
    STATUS_CHANGE: "STATUS_CHANGE",
    DEACTIVATE: "DEACTIVATE"
} as const;

export type AuditAction = typeof AUDIT_ACTION[keyof typeof AUDIT_ACTION];

export interface AuditLogInput {

    entity_type: string;
    entity_id: string;
    action: AuditAction;
    performed_by: string;
    patient_id?: string | null;
    branch_id?: string | null;
    change_summary: string;

}

export interface AuditLogFilterQuery {

    entity_type?: string;
    entity_id?: string;
    patient_id?: string;
    branch_id?: string;
    performed_by?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;

}
