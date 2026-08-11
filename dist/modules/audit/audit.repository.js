"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
class AuditRepository {
    async createAuditLog(tx, input) {
        const auditId = await (0, idGenerator_1.generateId)(tx, "ONCOLOGY_AUDIT_LOG");
        return tx.oncology_audit_log.create({
            data: {
                audit_id: auditId,
                entity_type: input.entity_type,
                entity_id: input.entity_id,
                action: input.action,
                performed_by: input.performed_by,
                patient_id: input.patient_id ?? null,
                branch_id: input.branch_id ?? null,
                change_summary: input.change_summary
            }
        });
    }
    async listAuditLogs(filters) {
        const page = filters.page && filters.page > 0 ? filters.page : 1;
        const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 50;
        const where = {
            ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
            ...(filters.entity_id ? { entity_id: filters.entity_id } : {}),
            ...(filters.patient_id ? { patient_id: filters.patient_id } : {}),
            ...(filters.branch_id ? { branch_id: filters.branch_id } : {}),
            ...(filters.performed_by ? { performed_by: filters.performed_by } : {}),
            ...(filters.action ? { action: filters.action } : {}),
            ...(filters.date_from || filters.date_to
                ? {
                    performed_at: {
                        ...(filters.date_from ? { gte: new Date(filters.date_from) } : {}),
                        ...(filters.date_to ? { lte: new Date(filters.date_to) } : {})
                    }
                }
                : {})
        };
        const [rows, total] = await Promise.all([
            prisma_1.default.oncology_audit_log.findMany({
                where,
                orderBy: { performed_at: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.oncology_audit_log.count({ where })
        ]);
        return { rows, total, page, limit };
    }
}
exports.AuditRepository = AuditRepository;
