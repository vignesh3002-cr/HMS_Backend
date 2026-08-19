"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicalDetailsService = void 0;
const clinical_details_repository_1 = require("./clinical-details.repository");
const clinical_details_constants_1 = require("./clinical-details.constants");
const prisma_1 = __importDefault(require("../../config/prisma"));
const repository = new clinical_details_repository_1.ClinicalDetailsRepository();
class ClinicalDetailsService {
    async createPerformanceStatus(data) {
        if (!Object.values(clinical_details_constants_1.PERFORMANCE_STATUS_CODES).includes(data.code)) {
            throw new Error('Invalid performance status code');
        }
        const existing = await repository.findPerformanceStatusByCode(data.code);
        if (existing) {
            throw new Error('Performance status code already exists');
        }
        return repository.createPerformanceStatus({
            code: data.code,
            description: data.description,
            display_order: data.displayOrder ?? 0,
            is_active: data.isActive ?? true,
            created_by: data.createdBy,
            updated_by: data.createdBy,
        });
    }
    async updatePerformanceStatus(id, data) {
        const existing = await repository.findPerformanceStatusById(id);
        if (!existing) {
            throw new Error('Performance status not found');
        }
        if (data.isActive === false) {
            const referenced = await repository.checkPerformanceStatusReferenced(id);
            if (referenced) {
                throw new Error('Cannot deactivate: performance status is referenced by clinical records');
            }
        }
        return repository.updatePerformanceStatus(id, {
            description: data.description,
            display_order: data.displayOrder,
            is_active: data.isActive,
            updated_by: data.updatedBy,
            updated_at: new Date(),
        });
    }
    async getPerformanceStatuses(query) {
        return repository.getPerformanceStatuses(query);
    }
    async createSymptom(data) {
        const existing = await repository.findSymptomByCode(data.code);
        if (existing) {
            throw new Error('Symptom code already exists');
        }
        return repository.createSymptom({
            code: data.code,
            name: data.name,
            description: data.description,
            category: data.category,
            body_system: data.bodySystem,
            is_active: data.isActive ?? true,
            created_by: data.createdBy,
            updated_by: data.createdBy,
        });
    }
    async updateSymptom(id, data) {
        const existing = await repository.findSymptomById(id);
        if (!existing) {
            throw new Error('Symptom not found');
        }
        if (data.isActive === false) {
            const referenced = await repository.checkSymptomReferenced(id);
            if (referenced) {
                throw new Error('Cannot deactivate: symptom is referenced by clinical records');
            }
        }
        return repository.updateSymptom(id, {
            name: data.name,
            description: data.description,
            category: data.category,
            body_system: data.bodySystem,
            is_active: data.isActive,
            updated_by: data.updatedBy,
            updated_at: new Date(),
        });
    }
    async getSymptoms(query) {
        return repository.getSymptoms(query);
    }
    async createAllergy(data) {
        const existing = await repository.findAllergyByCode(data.code);
        if (existing) {
            throw new Error('Allergy code already exists');
        }
        return repository.createAllergy({
            code: data.code,
            substance_name: data.substanceName,
            substance_type: data.substanceType,
            description: data.description,
            severity_level: data.severityLevel,
            is_active: data.isActive ?? true,
            created_by: data.createdBy,
            updated_by: data.createdBy,
        });
    }
    async updateAllergy(id, data) {
        const existing = await repository.findAllergyById(id);
        if (!existing) {
            throw new Error('Allergy not found');
        }
        if (data.isActive === false) {
            const referenced = await repository.checkAllergyReferenced(id);
            if (referenced) {
                throw new Error('Cannot deactivate: allergy is referenced by patient records');
            }
        }
        return repository.updateAllergy(id, {
            substance_name: data.substanceName,
            substance_type: data.substanceType,
            description: data.description,
            severity_level: data.severityLevel,
            is_active: data.isActive,
            updated_by: data.updatedBy,
            updated_at: new Date(),
        });
    }
    async getAllergies(query) {
        return repository.getAllergies(query);
    }
    async setEncounterPerformanceStatus(data, assessedBy) {
        const encounter = await repository.findEncounterByNo(data.encounterNo);
        if (!encounter) {
            throw new Error('Encounter not found');
        }
        const perfStatus = await repository.findPerformanceStatusById(data.performanceStatusId);
        if (!perfStatus) {
            throw new Error('Performance status not found');
        }
        if (!perfStatus.is_active) {
            throw new Error('Performance status is inactive');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.upsertEncounterPerformanceStatus(tx, data.encounterNo, {
                encounter_no: data.encounterNo,
                performance_status_id: data.performanceStatusId,
                assessed_by: assessedBy,
                assessed_at: new Date(),
                clinical_notes: data.clinicalNotes,
            });
        });
    }
    async getEncounterPerformanceStatus(encounterNo) {
        return repository.findEncounterPerformanceStatus(encounterNo);
    }
    async addEncounterSymptom(data, recordedBy) {
        const encounter = await repository.findEncounterByNo(data.encounterNo);
        if (!encounter) {
            throw new Error('Encounter not found');
        }
        const symptom = await repository.findSymptomById(data.symptomId);
        if (!symptom) {
            throw new Error('Symptom not found');
        }
        if (!symptom.is_active) {
            throw new Error('Symptom is inactive');
        }
        const existing = await repository.findEncounterSymptom(data.encounterNo, data.symptomId, 'ACTIVE');
        if (existing) {
            throw new Error('Symptom already added to this encounter');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.createEncounterSymptom(tx, {
                encounter_no: data.encounterNo,
                symptom_id: data.symptomId,
                severity: data.severity,
                duration_days: data.durationDays,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                clinical_notes: data.clinicalNotes,
                status: clinical_details_constants_1.ENCOUNTER_SYMPTOM_STATUS.ACTIVE,
                recorded_by: recordedBy,
                recorded_at: new Date(),
                updated_at: new Date(),
            });
        });
    }
    async getEncounterSymptoms(encounterNo) {
        const encounter = await repository.findEncounterByNo(encounterNo);
        if (!encounter) {
            throw new Error('Encounter not found');
        }
        return repository.getEncounterSymptoms(encounterNo);
    }
    async updateEncounterSymptom(encounterNo, symptomId, data, updatedBy) {
        const encounter = await repository.findEncounterByNo(encounterNo);
        if (!encounter) {
            throw new Error('Encounter not found');
        }
        const existing = await repository.findEncounterSymptom(encounterNo, symptomId, 'ACTIVE');
        if (!existing) {
            throw new Error('Symptom not found in this encounter');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.updateEncounterSymptom(tx, encounterNo, symptomId, {
                severity: data.severity,
                duration_days: data.durationDays,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                clinical_notes: data.clinicalNotes,
                status: data.status,
            });
        });
    }
    async removeEncounterSymptom(encounterNo, symptomId) {
        const encounter = await repository.findEncounterByNo(encounterNo);
        if (!encounter) {
            throw new Error('Encounter not found');
        }
        const existing = await repository.findEncounterSymptom(encounterNo, symptomId, 'ACTIVE');
        if (!existing) {
            throw new Error('Symptom not found in this encounter');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.deleteEncounterSymptom(tx, encounterNo, symptomId);
        });
    }
    async addPatientAllergy(patientId, data, identifiedBy) {
        const patient = await prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error('Patient not found');
        }
        const allergy = await repository.findAllergyById(data.allergyId);
        if (!allergy) {
            throw new Error('Allergy not found');
        }
        if (!allergy.is_active) {
            throw new Error('Allergy is inactive');
        }
        const existing = await repository.findPatientAllergy(patientId, data.allergyId, 'ACTIVE');
        if (existing) {
            throw new Error('Patient already has this allergy active');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.createPatientAllergy(tx, {
                patient_id: patientId,
                allergy_id: data.allergyId,
                reaction: data.reaction,
                severity: data.severity,
                status: data.status ?? clinical_details_constants_1.ALLERGY_STATUS.ACTIVE,
                identified_by: identifiedBy,
                identified_at_encounter_no: data.identifiedAtEncounterNo,
                clinical_notes: data.clinicalNotes,
                identified_at: new Date(),
                updated_at: new Date(),
                updated_by: identifiedBy,
            });
        });
    }
    async getPatientAllergies(patientId) {
        const patient = await prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error('Patient not found');
        }
        return repository.getPatientAllergies(patientId);
    }
    async updatePatientAllergy(patientId, recordId, data, updatedBy) {
        const record = await repository.findPatientAllergyById(recordId);
        if (!record) {
            throw new Error('Allergy record not found');
        }
        if (record.patient_id !== patientId) {
            throw new Error('Allergy record does not belong to this patient');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.updatePatientAllergy(tx, recordId, {
                reaction: data.reaction,
                severity: data.severity,
                status: data.status,
                clinical_notes: data.clinicalNotes,
                updated_by: updatedBy,
            });
        });
    }
    async removePatientAllergy(patientId, recordId) {
        const record = await repository.findPatientAllergyById(recordId);
        if (!record) {
            throw new Error('Allergy record not found');
        }
        if (record.patient_id !== patientId) {
            throw new Error('Allergy record does not belong to this patient');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.deletePatientAllergy(tx, recordId);
        });
    }
    async addPatientComorbidity(patientId, data, identifiedBy) {
        const patient = await prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error('Patient not found');
        }
        const diagnosis = await prisma_1.default.diagnosis.findUnique({
            where: { diagnosis_id: data.diagnosisId },
        });
        if (!diagnosis) {
            throw new Error('Diagnosis not found');
        }
        if (diagnosis.active_status !== 1) {
            throw new Error('Diagnosis is inactive');
        }
        const existing = await repository.findPatientComorbidity(patientId, data.diagnosisId, 'ACTIVE');
        if (existing) {
            throw new Error('Patient already has this comorbidity active');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.createPatientComorbidity(tx, {
                patient_id: patientId,
                diagnosis_id: data.diagnosisId,
                status: data.status ?? clinical_details_constants_1.COMORBIDITY_STATUS.ACTIVE,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                identified_by: identifiedBy,
                identified_at_encounter_no: data.identifiedAtEncounterNo,
                clinical_notes: data.clinicalNotes,
                identified_at: new Date(),
                updated_at: new Date(),
                updated_by: identifiedBy,
            });
        });
    }
    async getPatientComorbidities(patientId) {
        const patient = await prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error('Patient not found');
        }
        return repository.getPatientComorbidities(patientId);
    }
    async updatePatientComorbidity(patientId, recordId, data, updatedBy) {
        const record = await repository.findPatientComorbidityById(recordId);
        if (!record) {
            throw new Error('Comorbidity record not found');
        }
        if (record.patient_id !== patientId) {
            throw new Error('Comorbidity record does not belong to this patient');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.updatePatientComorbidity(tx, recordId, {
                status: data.status,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                clinical_notes: data.clinicalNotes,
                updated_by: updatedBy,
            });
        });
    }
    async removePatientComorbidity(patientId, recordId) {
        const record = await repository.findPatientComorbidityById(recordId);
        if (!record) {
            throw new Error('Comorbidity record not found');
        }
        if (record.patient_id !== patientId) {
            throw new Error('Comorbidity record does not belong to this patient');
        }
        return prisma_1.default.$transaction(async (tx) => {
            return repository.deletePatientComorbidity(tx, recordId);
        });
    }
    async getCompleteClinicalDetails(encounterNo) {
        return repository.getCompleteClinicalDetails(encounterNo);
    }
}
exports.ClinicalDetailsService = ClinicalDetailsService;
