"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientDocumentRepository = exports.PatientDocumentRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const METADATA_SELECT = {
    id: true,
    document_id: true,
    patient_id: true,
    file_name: true,
    original_name: true,
    file_type: true,
    file_size: true,
    category: true,
    uploaded_by: true,
    created_at: true,
    updated_at: true,
    encounter_no: true,
    document_type: true,
    chemotherapy_plan_id: true,
};
const toMeta = (r) => ({
    id: r.document_id,
    document_id: r.document_id,
    patient_id: r.patient_id,
    file_name: r.file_name,
    original_name: r.original_name,
    file_type: r.file_type,
    file_size: Number(r.file_size),
    category: r.category,
    uploaded_by: r.uploaded_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    encounter_no: r.encounter_no ?? null,
    document_type: r.document_type ?? null,
    chemotherapy_plan_id: r.chemotherapy_plan_id ?? null,
});
class PatientDocumentRepository {
    async createDocument(data) {
        const record = await prisma_1.default.patient_document.create({
            data: {
                document_id: data.document_id,
                patient_id: data.patient_id,
                file_name: data.file_name,
                original_name: data.original_name,
                file_type: data.file_type,
                file_size: BigInt(data.file_size),
                file_data: data.file_data,
                category: data.category || "Clinical",
                uploaded_by: data.uploaded_by || null,
                encounter_no: data.encounter_no || null,
                document_type: data.document_type || null,
                chemotherapy_plan_id: data.chemotherapy_plan_id || null,
            },
            select: METADATA_SELECT,
        });
        return toMeta(record);
    }
    async findByPatientId(patientId, filter = {}) {
        const records = await prisma_1.default.patient_document.findMany({
            where: {
                patient_id: patientId,
                ...(filter.document_type ? { document_type: filter.document_type } : {}),
                ...(filter.chemotherapy_plan_id
                    ? { chemotherapy_plan_id: filter.chemotherapy_plan_id }
                    : {}),
                ...(filter.unassigned ? { chemotherapy_plan_id: null } : {}),
            },
            orderBy: { created_at: "desc" },
            select: METADATA_SELECT,
        });
        return records.map(toMeta);
    }
    /** Consent (or other) documents attached to one planned chemotherapy course.
     *  Documents uploaded before plan tracking (NULL plan) still belong to the
     *  plan when they were filed against the plan's own encounter. */
    async findByPlanId(planId, documentType) {
        const plan = await prisma_1.default.chemotherapy_plan.findUnique({
            where: { chemotherapy_plan_id: planId },
            select: { patient_id: true, encounter_no: true },
        });
        if (!plan)
            return [];
        const records = await prisma_1.default.patient_document.findMany({
            where: {
                patient_id: plan.patient_id,
                ...(documentType ? { document_type: documentType } : {}),
                OR: [
                    { chemotherapy_plan_id: planId },
                    ...(plan.encounter_no
                        ? [{ chemotherapy_plan_id: null, encounter_no: plan.encounter_no }]
                        : []),
                ],
            },
            orderBy: { created_at: "asc" },
            select: METADATA_SELECT,
        });
        return records.map(toMeta);
    }
    async attachToPlan(documentId, planId) {
        const records = await prisma_1.default.patient_document.updateMany({
            where: {
                document_id: documentId,
                OR: [{ chemotherapy_plan_id: null }, { chemotherapy_plan_id: planId }],
            },
            data: {
                chemotherapy_plan_id: planId,
                updated_at: new Date(),
            },
        });
        if (records.count === 0)
            return null;
        return this.findByDocumentId(documentId);
    }
    async countByPlanAndType(planId, documentType) {
        return prisma_1.default.patient_document.count({
            where: { chemotherapy_plan_id: planId, document_type: documentType },
        });
    }
    /** Documents attached to one OPD visit or IPD stay -- the common link. */
    async findByEncounterNo(encounterNo) {
        const records = await prisma_1.default.patient_document.findMany({
            where: { encounter_no: encounterNo },
            orderBy: { created_at: "desc" },
            select: METADATA_SELECT,
        });
        return records.map(toMeta);
    }
    async findByDocumentId(documentId) {
        const record = await prisma_1.default.patient_document.findUnique({
            where: { document_id: documentId },
        });
        if (!record)
            return null;
        return {
            ...toMeta(record),
            file_data: record.file_data,
        };
    }
    async deleteByDocumentId(documentId) {
        const deleted = await prisma_1.default.patient_document.deleteMany({
            where: { document_id: documentId },
        });
        return deleted.count > 0;
    }
}
exports.PatientDocumentRepository = PatientDocumentRepository;
exports.patientDocumentRepository = new PatientDocumentRepository();
