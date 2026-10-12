"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientDocumentService = exports.PatientDocumentService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const patientDocument_repository_1 = require("./patientDocument.repository");
const patientDocument_constants_1 = require("./patientDocument.constants");
class PatientDocumentService {
    repo;
    constructor(repo = patientDocument_repository_1.patientDocumentRepository) {
        this.repo = repo;
    }
    async uploadDocument(dto) {
        if (!dto.patient_id) {
            throw new Error("patient_id is required");
        }
        if (!dto.file_name) {
            throw new Error("file_name is required");
        }
        if (!dto.file_data) {
            throw new Error("file_data is required");
        }
        if (dto.document_type && !patientDocument_constants_1.DOCUMENT_TYPE_VALUES.includes(dto.document_type)) {
            throw new Error(`document_type must be one of: ${patientDocument_constants_1.DOCUMENT_TYPE_VALUES.join(", ")}`);
        }
        // A document can only be scoped to an encounter that exists, and to
        // *this* patient's encounter -- otherwise it'd be filed under the wrong
        // visit/stay and never show up where it's expected.
        if (dto.encounter_no) {
            const encounter = await prisma_1.default.encounter.findUnique({
                where: { encounter_no: dto.encounter_no },
                select: { patient_id: true },
            });
            if (!encounter) {
                throw new Error("Encounter not found");
            }
            if (encounter.patient_id !== dto.patient_id) {
                throw new Error("Encounter does not belong to this patient");
            }
        }
        // Strip base64 data prefix if present (e.g. data:image/png;base64,....)
        let rawBase64 = dto.file_data;
        if (rawBase64.includes(";base64,")) {
            rawBase64 = rawBase64.split(";base64,")[1];
        }
        const documentId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const originalName = dto.original_name || dto.file_name;
        const fileType = dto.file_type || "application/octet-stream";
        const fileSize = dto.file_size || Math.round((rawBase64.length * 3) / 4);
        return this.repo.createDocument({
            document_id: documentId,
            patient_id: dto.patient_id,
            file_name: dto.file_name,
            original_name: originalName,
            file_type: fileType,
            file_size: fileSize,
            file_data: rawBase64,
            category: dto.category || "Clinical",
            uploaded_by: dto.uploaded_by || "Doctor",
            encounter_no: dto.encounter_no,
            document_type: dto.document_type,
        });
    }
    async getDocumentsByPatient(patientId) {
        if (!patientId)
            return [];
        return this.repo.findByPatientId(patientId);
    }
    /** Documents attached to one OPD visit or IPD stay. */
    async getDocumentsByEncounter(encounterNo) {
        if (!encounterNo)
            return [];
        return this.repo.findByEncounterNo(encounterNo);
    }
    async getDocumentById(documentId) {
        if (!documentId)
            return null;
        return this.repo.findByDocumentId(documentId);
    }
    async deleteDocument(documentId) {
        if (!documentId)
            return false;
        return this.repo.deleteByDocumentId(documentId);
    }
}
exports.PatientDocumentService = PatientDocumentService;
exports.patientDocumentService = new PatientDocumentService();
