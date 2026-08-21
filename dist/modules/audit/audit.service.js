"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffFields = diffFields;
exports.summarizeCreate = summarizeCreate;
exports.summarizeStatusChange = summarizeStatusChange;
exports.logAudit = logAudit;
exports.listAuditLogs = listAuditLogs;
const audit_repository_1 = require("./audit.repository");
const repository = new audit_repository_1.AuditRepository();
// Every write site already builds a sparse "only the fields being changed"
// object (the `...(dto.x !== undefined ? { x: dto.x } : {})` pattern used
// throughout oncology.service.ts / chemotherapy.service.ts) - this just
// pairs each of those fields with its prior value from the row fetched
// before the update, so the log reads as old -> new per field rather than
// a full before/after row dump.
function diffFields(before, changes) {
    const diff = {};
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
function summarizeCreate(fields) {
    return JSON.stringify(fields);
}
function summarizeStatusChange(oldStatus, newStatus, reason) {
    return JSON.stringify({ from: oldStatus, to: newStatus, reason: reason ?? null });
}
async function logAudit(tx, input) {
    return repository.createAuditLog(tx, input);
}
async function listAuditLogs(filters) {
    return repository.listAuditLogs(filters);
}
