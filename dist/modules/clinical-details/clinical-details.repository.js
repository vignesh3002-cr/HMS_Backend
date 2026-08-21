"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicalDetailsRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class ClinicalDetailsRepository {
    async findPerformanceStatusById(id) {
        return prisma_1.default.performance_status_master.findUnique({
            where: { id },
        });
    }
    async findPerformanceStatusByCode(code) {
        return prisma_1.default.performance_status_master.findUnique({
            where: { code },
        });
    }
    async createPerformanceStatus(data) {
        return prisma_1.default.performance_status_master.create({ data });
    }
    async updatePerformanceStatus(id, data) {
        return prisma_1.default.performance_status_master.update({
            where: { id },
            data,
        });
    }
    async getPerformanceStatuses(query) {
        const { page = 1, limit = 50, search, isActive } = query;
        const where = {};
        if (isActive !== undefined)
            where.is_active = isActive;
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [items, total] = await Promise.all([
            prisma_1.default.performance_status_master.findMany({
                where,
                orderBy: { display_order: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.default.performance_status_master.count({ where }),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async checkPerformanceStatusReferenced(id) {
        const count = await prisma_1.default.encounter_performance_status.count({
            where: { performance_status_id: id },
        });
        return count > 0;
    }
    async findSymptomById(id) {
        return prisma_1.default.symptom_master.findUnique({
            where: { id },
        });
    }
    async findSymptomByCode(code) {
        return prisma_1.default.symptom_master.findUnique({
            where: { code },
        });
    }
    async createSymptom(data) {
        return prisma_1.default.symptom_master.create({ data });
    }
    async updateSymptom(id, data) {
        return prisma_1.default.symptom_master.update({
            where: { id },
            data,
        });
    }
    async getSymptoms(query) {
        const { page = 1, limit = 50, search, isActive, category } = query;
        const where = {};
        if (isActive !== undefined)
            where.is_active = isActive;
        if (category)
            where.category = category;
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [items, total] = await Promise.all([
            prisma_1.default.symptom_master.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.default.symptom_master.count({ where }),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async checkSymptomReferenced(id) {
        const count = await prisma_1.default.encounter_symptom.count({
            where: { symptom_id: id },
        });
        return count > 0;
    }
    async findAllergyById(id) {
        return prisma_1.default.allergy_master.findUnique({
            where: { id },
        });
    }
    async findAllergyByCode(code) {
        return prisma_1.default.allergy_master.findUnique({
            where: { code },
        });
    }
    async createAllergy(data) {
        return prisma_1.default.allergy_master.create({ data });
    }
    async updateAllergy(id, data) {
        return prisma_1.default.allergy_master.update({
            where: { id },
            data,
        });
    }
    async getAllergies(query) {
        const { page = 1, limit = 50, search, isActive, substanceType } = query;
        const where = {};
        if (isActive !== undefined)
            where.is_active = isActive;
        if (substanceType)
            where.substance_type = substanceType;
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { substance_name: { contains: search, mode: 'insensitive' } },
                { substance_type: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [items, total] = await Promise.all([
            prisma_1.default.allergy_master.findMany({
                where,
                orderBy: { substance_name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.default.allergy_master.count({ where }),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async checkAllergyReferenced(id) {
        const count = await prisma_1.default.patient_allergy.count({
            where: { allergy_id: id },
        });
        return count > 0;
    }
    async findEncounterByNo(encounterNo) {
        return prisma_1.default.encounter.findUnique({
            where: { encounter_no: encounterNo },
            include: {
                patient_bio_data: { select: { patient_id: true } },
            },
        });
    }
    async findEncounterPerformanceStatus(encounterNo) {
        return prisma_1.default.encounter_performance_status.findUnique({
            where: { encounter_no: encounterNo },
            include: {
                performance_status_master: true,
                employees: {
                    select: { employee_id: true, first_name: true, last_name: true },
                },
            },
        });
    }
    async upsertEncounterPerformanceStatus(tx, encounterNo, data) {
        return tx.encounter_performance_status.upsert({
            where: { encounter_no: encounterNo },
            create: data,
            update: {
                performance_status_id: data.performance_status_id,
                assessed_by: data.assessed_by,
                clinical_notes: data.clinical_notes,
                updated_at: new Date(),
            },
            include: {
                performance_status_master: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
            },
        });
    }
    async getEncounterSymptoms(encounterNo) {
        return prisma_1.default.encounter_symptom.findMany({
            where: { encounter_no: encounterNo },
            include: {
                symptom_master: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
            },
            orderBy: { recorded_at: 'desc' },
        });
    }
    async findEncounterSymptom(encounterNo, symptomId, status) {
        return prisma_1.default.encounter_symptom.findFirst({
            where: {
                encounter_no: encounterNo,
                symptom_id: symptomId,
                ...(status ? { status } : {}),
            },
        });
    }
    async createEncounterSymptom(tx, data) {
        return tx.encounter_symptom.create({ data });
    }
    async updateEncounterSymptom(tx, encounterNo, symptomId, data) {
        return tx.encounter_symptom.update({
            where: {
                encounter_no_symptom_id_status: {
                    encounter_no: encounterNo,
                    symptom_id: symptomId,
                    status: 'ACTIVE',
                },
            },
            data: {
                ...data,
                updated_at: new Date(),
            },
            include: {
                symptom_master: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
            },
        });
    }
    async deleteEncounterSymptom(tx, encounterNo, symptomId) {
        return tx.encounter_symptom.delete({
            where: {
                encounter_no_symptom_id_status: {
                    encounter_no: encounterNo,
                    symptom_id: symptomId,
                    status: 'ACTIVE',
                },
            },
        });
    }
    async getPatientAllergies(patientId) {
        return prisma_1.default.patient_allergy.findMany({
            where: { patient_id: patientId },
            include: {
                allergy_master: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
                encounter: { select: { encounter_no: true, encounter_ts: true } },
            },
            orderBy: { identified_at: 'desc' },
        });
    }
    async findPatientAllergy(patientId, allergyId, status) {
        return prisma_1.default.patient_allergy.findFirst({
            where: {
                patient_id: patientId,
                allergy_id: allergyId,
                ...(status ? { status } : {}),
            },
        });
    }
    async findPatientAllergyById(recordId) {
        return prisma_1.default.patient_allergy.findUnique({
            where: { id: recordId },
            include: {
                allergy_master: true,
                patient_bio_data: { select: { patient_id: true } },
            },
        });
    }
    async createPatientAllergy(tx, data) {
        return tx.patient_allergy.create({ data });
    }
    async updatePatientAllergy(tx, recordId, data) {
        return tx.patient_allergy.update({
            where: { id: recordId },
            data: { ...data, updated_at: new Date() },
            include: {
                allergy_master: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
            },
        });
    }
    async deletePatientAllergy(tx, recordId) {
        return tx.patient_allergy.delete({ where: { id: recordId } });
    }
    async getPatientComorbidities(patientId) {
        return prisma_1.default.patient_comorbidity.findMany({
            where: { patient_id: patientId },
            include: {
                diagnosis: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
                encounter: { select: { encounter_no: true, encounter_ts: true } },
            },
            orderBy: { identified_at: 'desc' },
        });
    }
    async findPatientComorbidity(patientId, diagnosisId, status) {
        return prisma_1.default.patient_comorbidity.findFirst({
            where: {
                patient_id: patientId,
                diagnosis_id: diagnosisId,
                ...(status ? { status } : {}),
            },
        });
    }
    async findPatientComorbidityById(recordId) {
        return prisma_1.default.patient_comorbidity.findUnique({
            where: { id: recordId },
            include: {
                diagnosis: true,
                patient_bio_data: { select: { patient_id: true } },
            },
        });
    }
    async createPatientComorbidity(tx, data) {
        return tx.patient_comorbidity.create({ data });
    }
    async updatePatientComorbidity(tx, recordId, data) {
        return tx.patient_comorbidity.update({
            where: { id: recordId },
            data: { ...data, updated_at: new Date() },
            include: {
                diagnosis: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
            },
        });
    }
    async deletePatientComorbidity(tx, recordId) {
        return tx.patient_comorbidity.delete({ where: { id: recordId } });
    }
    async getCompleteClinicalDetails(encounterNo) {
        const encounter = await prisma_1.default.encounter.findUnique({
            where: { encounter_no: encounterNo },
            select: {
                encounter_no: true,
                patient_id: true,
                encounter_ts: true,
                status: true,
                patient_bio_data: { select: { patient_id: true } },
            },
        });
        if (!encounter)
            return null;
        const [performanceStatus, symptoms, allergies, comorbidities] = await Promise.all([
            this.findEncounterPerformanceStatus(encounterNo),
            this.getEncounterSymptoms(encounterNo),
            this.getPatientAllergies(encounter.patient_id),
            this.getPatientComorbidities(encounter.patient_id),
        ]);
        return {
            encounter: {
                encounterNo: encounter.encounter_no,
                patientId: encounter.patient_id,
                encounterTs: encounter.encounter_ts,
                status: encounter.status,
            },
            performanceStatus: performanceStatus
                ? {
                    id: performanceStatus.performance_status_master.id,
                    code: performanceStatus.performance_status_master.code,
                    description: performanceStatus.performance_status_master.description,
                    assessedAt: performanceStatus.assessed_at,
                    assessedBy: performanceStatus.assessed_by,
                    clinicalNotes: performanceStatus.clinical_notes,
                }
                : null,
            symptoms: symptoms.map((s) => ({
                id: s.id,
                symptomId: s.symptom_id,
                symptomCode: s.symptom_master.code,
                symptomName: s.symptom_master.name,
                severity: s.severity,
                durationDays: s.duration_days,
                onsetDate: s.onset_date,
                clinicalNotes: s.clinical_notes,
                status: s.status,
                recordedAt: s.recorded_at,
                recordedBy: s.recorded_by,
            })),
            allergies: allergies.map((a) => ({
                id: a.id,
                allergyId: a.allergy_id,
                allergyCode: a.allergy_master.code,
                substanceName: a.allergy_master.substance_name,
                substanceType: a.allergy_master.substance_type,
                reaction: a.reaction,
                severity: a.severity,
                status: a.status,
                identifiedAt: a.identified_at,
                identifiedBy: a.identified_by,
                identifiedAtEncounterNo: a.identified_at_encounter_no,
                clinicalNotes: a.clinical_notes,
            })),
            comorbidities: comorbidities.map((c) => ({
                id: c.id,
                diagnosisId: c.diagnosis_id,
                diagnosisName: c.diagnosis.diagnosis_name,
                icdCode: c.diagnosis.icd_code,
                status: c.status,
                onsetDate: c.onset_date,
                identifiedAt: c.identified_at,
                identifiedBy: c.identified_by,
                identifiedAtEncounterNo: c.identified_at_encounter_no,
                clinicalNotes: c.clinical_notes,
            })),
        };
    }
}
exports.ClinicalDetailsRepository = ClinicalDetailsRepository;
