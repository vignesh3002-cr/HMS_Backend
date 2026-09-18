"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientDocumentRepository = exports.PatientDocumentRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
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
            },
            select: {
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
            },
        });
        return {
            id: record.document_id,
            document_id: record.document_id,
            patient_id: record.patient_id,
            file_name: record.file_name,
            original_name: record.original_name,
            file_type: record.file_type,
            file_size: Number(record.file_size),
            category: record.category,
            uploaded_by: record.uploaded_by,
            created_at: record.created_at,
            updated_at: record.updated_at,
        };
    }
    async findByPatientId(patientId) {
        const records = await prisma_1.default.patient_document.findMany({
            where: { patient_id: patientId },
            orderBy: { created_at: "desc" },
            select: {
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
            },
        });
        return records.map((r) => ({
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
        }));
    }
    async findByDocumentId(documentId) {
        const record = await prisma_1.default.patient_document.findUnique({
            where: { document_id: documentId },
        });
        if (!record)
            return null;
        return {
            id: record.document_id,
            document_id: record.document_id,
            patient_id: record.patient_id,
            file_name: record.file_name,
            original_name: record.original_name,
            file_type: record.file_type,
            file_size: Number(record.file_size),
            file_data: record.file_data,
            category: record.category,
            uploaded_by: record.uploaded_by,
            created_at: record.created_at,
            updated_at: record.updated_at,
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
