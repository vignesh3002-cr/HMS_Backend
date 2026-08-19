import { ClinicalDetailsRepository } from './clinical-details.repository';
import {
    PerformanceStatusMasterDTO,
    UpdatePerformanceStatusMasterDTO,
    SymptomMasterDTO,
    UpdateSymptomMasterDTO,
    AllergyMasterDTO,
    UpdateAllergyMasterDTO,
    EncounterPerformanceStatusDTO,
    EncounterSymptomDTO,
    UpdateEncounterSymptomDTO,
    PatientAllergyDTO,
    UpdatePatientAllergyDTO,
    PatientComorbidityDTO,
    UpdatePatientComorbidityDTO,
    GetClinicalDetailsResponse,
    ClinicalDetailsQuery,
} from './clinical-details.types';
import { PERFORMANCE_STATUS_CODES, SYMPTOM_SEVERITY, ALLERGY_SEVERITY, ALLERGY_STATUS, COMORBIDITY_STATUS, ENCOUNTER_SYMPTOM_STATUS } from './clinical-details.constants';
import prisma from '../../config/prisma';

const repository = new ClinicalDetailsRepository();

export class ClinicalDetailsService {
    async createPerformanceStatus(data: PerformanceStatusMasterDTO) {
        if (!Object.values(PERFORMANCE_STATUS_CODES).includes(data.code as any)) {
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

    async updatePerformanceStatus(id: number, data: UpdatePerformanceStatusMasterDTO) {
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

    async getPerformanceStatuses(query: ClinicalDetailsQuery) {
        return repository.getPerformanceStatuses(query);
    }

    async createSymptom(data: SymptomMasterDTO) {
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

    async updateSymptom(id: number, data: UpdateSymptomMasterDTO) {
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

    async getSymptoms(query: ClinicalDetailsQuery & { category?: string }) {
        return repository.getSymptoms(query);
    }

    async createAllergy(data: AllergyMasterDTO) {
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

    async updateAllergy(id: number, data: UpdateAllergyMasterDTO) {
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

    async getAllergies(query: ClinicalDetailsQuery & { substanceType?: string }) {
        return repository.getAllergies(query);
    }

    async setEncounterPerformanceStatus(data: EncounterPerformanceStatusDTO, assessedBy: string | null) {
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

        return prisma.$transaction(async (tx) => {
            return repository.upsertEncounterPerformanceStatus(tx, data.encounterNo, {
                encounter_no: data.encounterNo,
                performance_status_id: data.performanceStatusId,
                assessed_by: assessedBy,
                assessed_at: new Date(),
                clinical_notes: data.clinicalNotes,
            });
        });
    }

    async getEncounterPerformanceStatus(encounterNo: string) {
        return repository.findEncounterPerformanceStatus(encounterNo);
    }

    async addEncounterSymptom(data: EncounterSymptomDTO, recordedBy: string | null) {
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

        return prisma.$transaction(async (tx) => {
            return repository.createEncounterSymptom(tx, {
                encounter_no: data.encounterNo,
                symptom_id: data.symptomId,
                severity: data.severity,
                duration_days: data.durationDays,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                clinical_notes: data.clinicalNotes,
                status: ENCOUNTER_SYMPTOM_STATUS.ACTIVE,
                recorded_by: recordedBy,
                recorded_at: new Date(),
                updated_at: new Date(),
            });
        });
    }

    async getEncounterSymptoms(encounterNo: string) {
        const encounter = await repository.findEncounterByNo(encounterNo);
        if (!encounter) {
            throw new Error('Encounter not found');
        }
        return repository.getEncounterSymptoms(encounterNo);
    }

    async updateEncounterSymptom(
        encounterNo: string,
        symptomId: number,
        data: UpdateEncounterSymptomDTO,
        updatedBy: string
    ) {
        const encounter = await repository.findEncounterByNo(encounterNo);
        if (!encounter) {
            throw new Error('Encounter not found');
        }

        const existing = await repository.findEncounterSymptom(encounterNo, symptomId, 'ACTIVE');
        if (!existing) {
            throw new Error('Symptom not found in this encounter');
        }

        return prisma.$transaction(async (tx) => {
            return repository.updateEncounterSymptom(tx, encounterNo, symptomId, {
                severity: data.severity,
                duration_days: data.durationDays,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                clinical_notes: data.clinicalNotes,
                status: data.status,
            });
        });
    }

    async removeEncounterSymptom(encounterNo: string, symptomId: number) {
        const encounter = await repository.findEncounterByNo(encounterNo);
        if (!encounter) {
            throw new Error('Encounter not found');
        }

        const existing = await repository.findEncounterSymptom(encounterNo, symptomId, 'ACTIVE');
        if (!existing) {
            throw new Error('Symptom not found in this encounter');
        }

        return prisma.$transaction(async (tx) => {
            return repository.deleteEncounterSymptom(tx, encounterNo, symptomId);
        });
    }

    async addPatientAllergy(patientId: string, data: PatientAllergyDTO, identifiedBy: string | null) {
        const patient = await prisma.patient_bio_data.findUnique({
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

        return prisma.$transaction(async (tx) => {
            return repository.createPatientAllergy(tx, {
                patient_id: patientId,
                allergy_id: data.allergyId,
                reaction: data.reaction,
                severity: data.severity,
                status: data.status ?? ALLERGY_STATUS.ACTIVE,
                identified_by: identifiedBy,
                identified_at_encounter_no: data.identifiedAtEncounterNo,
                clinical_notes: data.clinicalNotes,
                identified_at: new Date(),
                updated_at: new Date(),
                updated_by: identifiedBy,
            });
        });
    }

    async getPatientAllergies(patientId: string) {
        const patient = await prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error('Patient not found');
        }
        return repository.getPatientAllergies(patientId);
    }

    async updatePatientAllergy(
        patientId: string,
        recordId: number,
        data: UpdatePatientAllergyDTO,
        updatedBy: string
    ) {
        const record = await repository.findPatientAllergyById(recordId);
        if (!record) {
            throw new Error('Allergy record not found');
        }
        if (record.patient_id !== patientId) {
            throw new Error('Allergy record does not belong to this patient');
        }

        return prisma.$transaction(async (tx) => {
            return repository.updatePatientAllergy(tx, recordId, {
                reaction: data.reaction,
                severity: data.severity,
                status: data.status,
                clinical_notes: data.clinicalNotes,
                updated_by: updatedBy,
            });
        });
    }

    async removePatientAllergy(patientId: string, recordId: number) {
        const record = await repository.findPatientAllergyById(recordId);
        if (!record) {
            throw new Error('Allergy record not found');
        }
        if (record.patient_id !== patientId) {
            throw new Error('Allergy record does not belong to this patient');
        }

        return prisma.$transaction(async (tx) => {
            return repository.deletePatientAllergy(tx, recordId);
        });
    }

    async addPatientComorbidity(patientId: string, data: PatientComorbidityDTO, identifiedBy: string | null) {
        const patient = await prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error('Patient not found');
        }

        const diagnosis = await prisma.diagnosis.findUnique({
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

        return prisma.$transaction(async (tx) => {
            return repository.createPatientComorbidity(tx, {
                patient_id: patientId,
                diagnosis_id: data.diagnosisId,
                status: data.status ?? COMORBIDITY_STATUS.ACTIVE,
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

    async getPatientComorbidities(patientId: string) {
        const patient = await prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error('Patient not found');
        }
        return repository.getPatientComorbidities(patientId);
    }

    async updatePatientComorbidity(
        patientId: string,
        recordId: number,
        data: UpdatePatientComorbidityDTO,
        updatedBy: string
    ) {
        const record = await repository.findPatientComorbidityById(recordId);
        if (!record) {
            throw new Error('Comorbidity record not found');
        }
        if (record.patient_id !== patientId) {
            throw new Error('Comorbidity record does not belong to this patient');
        }

        return prisma.$transaction(async (tx) => {
            return repository.updatePatientComorbidity(tx, recordId, {
                status: data.status,
                onset_date: data.onsetDate ? new Date(data.onsetDate) : null,
                clinical_notes: data.clinicalNotes,
                updated_by: updatedBy,
            });
        });
    }

    async removePatientComorbidity(patientId: string, recordId: number) {
        const record = await repository.findPatientComorbidityById(recordId);
        if (!record) {
            throw new Error('Comorbidity record not found');
        }
        if (record.patient_id !== patientId) {
            throw new Error('Comorbidity record does not belong to this patient');
        }

        return prisma.$transaction(async (tx) => {
            return repository.deletePatientComorbidity(tx, recordId);
        });
    }

    async getCompleteClinicalDetails(encounterNo: string): Promise<GetClinicalDetailsResponse | null> {
        return repository.getCompleteClinicalDetails(encounterNo);
    }
}