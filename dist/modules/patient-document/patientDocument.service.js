"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientDocumentService = exports.PatientDocumentService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const patientDocument_repository_1 = require("./patientDocument.repository");
const patientDocument_constants_1 = require("./patientDocument.constants");
const CONSENT_DOCUMENT_TYPE = patientDocument_constants_1.DOCUMENT_TYPE.CONSENT_FORM;
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
        let planConsentDate = null;
        if (dto.chemotherapy_plan_id) {
            const plan = await prisma_1.default.chemotherapy_plan.findUnique({
                where: { chemotherapy_plan_id: dto.chemotherapy_plan_id },
                select: { patient_id: true, consent_date: true },
            });
            if (!plan) {
                throw new Error("Chemotherapy plan not found");
            }
            if (plan.patient_id !== dto.patient_id) {
                throw new Error("Chemotherapy plan does not belong to this patient");
            }
            planConsentDate = plan.consent_date;
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
        const created = await this.repo.createDocument({
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
            chemotherapy_plan_id: dto.chemotherapy_plan_id,
        });
        // A signed consent form is itself proof of consent: the plan is ready to
        // start even when no e-signature was captured.
        if (dto.chemotherapy_plan_id &&
            dto.document_type === CONSENT_DOCUMENT_TYPE) {
            await prisma_1.default.chemotherapy_plan.update({
                where: { chemotherapy_plan_id: dto.chemotherapy_plan_id },
                data: {
                    consent_taken: true,
                    ...(planConsentDate ? {} : { consent_date: new Date() }),
                    updated_at: new Date(),
                },
            });
        }
        return created;
    }
    async getDocumentsByPatient(patientId, filter = {}) {
        if (!patientId)
            return [];
        return this.repo.findByPatientId(patientId, filter);
    }
    /** Documents attached to one OPD visit or IPD stay. */
    async getDocumentsByEncounter(encounterNo) {
        if (!encounterNo)
            return [];
        return this.repo.findByEncounterNo(encounterNo);
    }
    /** Documents attached to one planned chemotherapy course. */
    async getDocumentsByPlan(planId, documentType) {
        if (!planId)
            return [];
        return this.repo.findByPlanId(planId, documentType);
    }
    /** Attach an existing patient-level (legacy) document to a plan. */
    async attachDocumentToPlan(documentId, planId) {
        if (!documentId || !planId) {
            throw new Error("documentId and chemotherapy_plan_id are required");
        }
        const document = await this.repo.findByDocumentId(documentId);
        if (!document) {
            throw new Error("Document not found");
        }
        if (document.document_type !== CONSENT_DOCUMENT_TYPE) {
            throw new Error("Only consent forms can be attached to a chemotherapy plan");
        }
        if (document.chemotherapy_plan_id && document.chemotherapy_plan_id !== planId) {
            throw new Error("This consent form is already attached to another plan");
        }
        const plan = await prisma_1.default.chemotherapy_plan.findUnique({
            where: { chemotherapy_plan_id: planId },
            select: { patient_id: true, consent_date: true },
        });
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        if (plan.patient_id !== document.patient_id) {
            throw new Error("Chemotherapy plan does not belong to this patient");
        }
        const attached = await this.repo.attachToPlan(documentId, planId);
        if (!attached) {
            throw new Error("This consent form is already attached to another plan");
        }
        await prisma_1.default.chemotherapy_plan.update({
            where: { chemotherapy_plan_id: planId },
            data: {
                consent_taken: true,
                ...(plan.consent_date ? {} : { consent_date: new Date() }),
                updated_at: new Date(),
            },
        });
        return attached;
    }
    async getDocumentById(documentId) {
        if (!documentId)
            return null;
        return this.repo.findByDocumentId(documentId);
    }
    async deleteDocument(documentId) {
        if (!documentId)
            return false;
        const document = await this.repo.findByDocumentId(documentId);
        const deleted = await this.repo.deleteByDocumentId(documentId);
        if (deleted && document?.chemotherapy_plan_id) {
            await this.syncPlanConsent(document.chemotherapy_plan_id);
        }
        return deleted;
    }
    /** Recompute the plan's consent flag after a document was removed. */
    async syncPlanConsent(planId) {
        const [documentCount, consent] = await Promise.all([
            this.repo.countByPlanAndType(planId, CONSENT_DOCUMENT_TYPE),
            prisma_1.default.chemotherapy_plan_consent.findUnique({
                where: { chemotherapy_plan_id: planId },
                select: { status: true },
            }),
        ]);
        const taken = documentCount > 0 || consent?.status === "SIGNED";
        await prisma_1.default.chemotherapy_plan.updateMany({
            where: { chemotherapy_plan_id: planId },
            data: {
                consent_taken: taken,
                ...(taken ? {} : { consent_date: null }),
                updated_at: new Date(),
            },
        });
    }
}
exports.PatientDocumentService = PatientDocumentService;
exports.patientDocumentService = new PatientDocumentService();
