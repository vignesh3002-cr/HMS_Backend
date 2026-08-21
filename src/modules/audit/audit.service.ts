import { Prisma } from "@prisma/client";
import { AuditRepository } from "./audit.repository";
import { AuditAction, AuditLogInput, AuditLogFilterQuery } from "./audit.types";

const repository = new AuditRepository();

// Every write site already builds a sparse "only the fields being changed"
// object (the `...(dto.x !== undefined ? { x: dto.x } : {})` pattern used
// throughout oncology.service.ts / chemotherapy.service.ts) - this just
// pairs each of those fields with its prior value from the row fetched
// before the update, so the log reads as old -> new per field rather than
// a full before/after row dump.
export function diffFields(before: Record<string, any>, changes: Record<string, any>): string {

    const diff: Record<string, { old: any; new: any }> = {};

    for (const key of Object.keys(changes)) {

        const oldValue = before[key];
        const newValue = changes[key];

        // Decimal/Date/BigInt don't compare equal with !== even when
        // logically identical - stringify both sides before comparing so
        // the log only records fields that actually changed.
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
            continue;
        }

        diff[key] = { old: oldValue ?? null, new: newValue ?? null };

    }

    return JSON.stringify(diff);

}

export function summarizeCreate(fields: Record<string, any>): string {

    return JSON.stringify(fields);

}

export function summarizeStatusChange(oldStatus: string, newStatus: string, reason?: string | null): string {

    return JSON.stringify({ from: oldStatus, to: newStatus, reason: reason ?? null });

}

export async function logAudit(tx: Prisma.TransactionClient, input: AuditLogInput) {

    return repository.createAuditLog(tx, input);

}

export async function listAuditLogs(filters: AuditLogFilterQuery) {

    return repository.listAuditLogs(filters);

}

export type { AuditAction };
