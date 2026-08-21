import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

export class ClinicalDetailsRepository {
    async findPerformanceStatusById(id: number) {
        return prisma.performance_status_master.findUnique({
            where: { id },
        });
    }

    async findPerformanceStatusByCode(code: string) {
        return prisma.performance_status_master.findUnique({
            where: { code },
        });
    }

    async createPerformanceStatus(data: Prisma.performance_status_masterUncheckedCreateInput) {
        return prisma.performance_status_master.create({ data });
    }

    async updatePerformanceStatus(id: number, data: Prisma.performance_status_masterUncheckedUpdateInput) {
        return prisma.performance_status_master.update({
            where: { id },
            data,
        });
    }

    async getPerformanceStatuses(query: { page?: number; limit?: number; search?: string; isActive?: boolean }) {
        const { page = 1, limit = 50, search, isActive } = query;
        const where: Prisma.performance_status_masterWhereInput = {};

        if (isActive !== undefined) where.is_active = isActive;

        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.performance_status_master.findMany({
                where,
                orderBy: { display_order: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.performance_status_master.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async checkPerformanceStatusReferenced(id: number) {
        const count = await prisma.encounter_performance_status.count({
            where: { performance_status_id: id },
        });
        return count > 0;
    }

    async findSymptomById(id: number) {
        return prisma.symptom_master.findUnique({
            where: { id },
        });
    }

    async findSymptomByCode(code: string) {
        return prisma.symptom_master.findUnique({
            where: { code },
        });
    }

    async createSymptom(data: Prisma.symptom_masterUncheckedCreateInput) {
        return prisma.symptom_master.create({ data });
    }

    async updateSymptom(id: number, data: Prisma.symptom_masterUncheckedUpdateInput) {
        return prisma.symptom_master.update({
            where: { id },
            data,
        });
    }

    async getSymptoms(query: { page?: number; limit?: number; search?: string; isActive?: boolean; category?: string }) {
        const { page = 1, limit = 50, search, isActive, category } = query;
        const where: Prisma.symptom_masterWhereInput = {};

        if (isActive !== undefined) where.is_active = isActive;
        if (category) where.category = category;

        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.symptom_master.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.symptom_master.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async checkSymptomReferenced(id: number) {
        const count = await prisma.encounter_symptom.count({
            where: { symptom_id: id },
        });
        return count > 0;
    }

    async findAllergyById(id: number) {
        return prisma.allergy_master.findUnique({
            where: { id },
        });
    }

    async findAllergyByCode(code: string) {
        return prisma.allergy_master.findUnique({
            where: { code },
        });
    }

    async createAllergy(data: Prisma.allergy_masterUncheckedCreateInput) {
        return prisma.allergy_master.create({ data });
    }

    async updateAllergy(id: number, data: Prisma.allergy_masterUncheckedUpdateInput) {
        return prisma.allergy_master.update({
            where: { id },
            data,
        });
    }

    async getAllergies(query: { page?: number; limit?: number; search?: string; isActive?: boolean; substanceType?: string }) {
        const { page = 1, limit = 50, search, isActive, substanceType } = query;
        const where: Prisma.allergy_masterWhereInput = {};

        if (isActive !== undefined) where.is_active = isActive;
        if (substanceType) where.substance_type = substanceType;

        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { substance_name: { contains: search, mode: 'insensitive' } },
                { substance_type: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.allergy_master.findMany({
                where,
                orderBy: { substance_name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.allergy_master.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async checkAllergyReferenced(id: number) {
        const count = await prisma.patient_allergy.count({
            where: { allergy_id: id },
        });
        return count > 0;
    }

    async findEncounterByNo(encounterNo: string) {
        return prisma.encounter.findUnique({
            where: { encounter_no: encounterNo },
            include: {
                patient_bio_data: { select: { patient_id: true } },
            },
        });
    }

    async findEncounterPerformanceStatus(encounterNo: string) {
        return prisma.encounter_performance_status.findUnique({
            where: { encounter_no: encounterNo },
            include: {
                performance_status_master: true,
                employees: {
                    select: { employee_id: true, first_name: true, last_name: true },
                },
            },
        });
    }

    async upsertEncounterPerformanceStatus(
        tx: Prisma.TransactionClient,
        encounterNo: string,
        data: Prisma.encounter_performance_statusUncheckedCreateInput
    ) {
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

    async getEncounterSymptoms(encounterNo: string) {
        return prisma.encounter_symptom.findMany({
            where: { encounter_no: encounterNo },
            include: {
                symptom_master: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
            },
            orderBy: { recorded_at: 'desc' },
        });
    }

    async findEncounterSymptom(encounterNo: string, symptomId: number, status?: string) {
        return prisma.encounter_symptom.findFirst({
            where: {
                encounter_no: encounterNo,
                symptom_id: symptomId,
                ...(status ? { status } : {}),
            },
        });
    }

    async createEncounterSymptom(
        tx: Prisma.TransactionClient,
        data: Prisma.encounter_symptomUncheckedCreateInput
    ) {
        return tx.encounter_symptom.create({ data });
    }

    async updateEncounterSymptom(
        tx: Prisma.TransactionClient,
        encounterNo: string,
        symptomId: number,
        data: Prisma.encounter_symptomUncheckedUpdateInput
    ) {
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

    async deleteEncounterSymptom(tx: Prisma.TransactionClient, encounterNo: string, symptomId: number) {
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

    async getPatientAllergies(patientId: string) {
        return prisma.patient_allergy.findMany({
            where: { patient_id: patientId },
            include: {
                allergy_master: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
                encounter: { select: { encounter_no: true, encounter_ts: true } },
            },
            orderBy: { identified_at: 'desc' },
        });
    }

    async findPatientAllergy(patientId: string, allergyId: number, status?: string) {
        return prisma.patient_allergy.findFirst({
            where: {
                patient_id: patientId,
                allergy_id: allergyId,
                ...(status ? { status } : {}),
            },
        });
    }

    async findPatientAllergyById(recordId: number) {
        return prisma.patient_allergy.findUnique({
            where: { id: recordId },
            include: {
                allergy_master: true,
                patient_bio_data: { select: { patient_id: true } },
            },
        });
    }

    async createPatientAllergy(
        tx: Prisma.TransactionClient,
        data: Prisma.patient_allergyUncheckedCreateInput
    ) {
        return tx.patient_allergy.create({ data });
    }

    async updatePatientAllergy(
        tx: Prisma.TransactionClient,
        recordId: number,
        data: Prisma.patient_allergyUncheckedUpdateInput
    ) {
        return tx.patient_allergy.update({
            where: { id: recordId },
            data: { ...data, updated_at: new Date() },
            include: {
                allergy_master: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
            },
        });
    }

    async deletePatientAllergy(tx: Prisma.TransactionClient, recordId: number) {
        return tx.patient_allergy.delete({ where: { id: recordId } });
    }

    async getPatientComorbidities(patientId: string) {
        return prisma.patient_comorbidity.findMany({
            where: { patient_id: patientId },
            include: {
                diagnosis: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
                encounter: { select: { encounter_no: true, encounter_ts: true } },
            },
            orderBy: { identified_at: 'desc' },
        });
    }

    async findPatientComorbidity(patientId: string, diagnosisId: string, status?: string) {
        return prisma.patient_comorbidity.findFirst({
            where: {
                patient_id: patientId,
                diagnosis_id: diagnosisId,
                ...(status ? { status } : {}),
            },
        });
    }

    async findPatientComorbidityById(recordId: number) {
        return prisma.patient_comorbidity.findUnique({
            where: { id: recordId },
            include: {
                diagnosis: true,
                patient_bio_data: { select: { patient_id: true } },
            },
        });
    }

    async createPatientComorbidity(
        tx: Prisma.TransactionClient,
        data: Prisma.patient_comorbidityUncheckedCreateInput
    ) {
        return tx.patient_comorbidity.create({ data });
    }

    async updatePatientComorbidity(
        tx: Prisma.TransactionClient,
        recordId: number,
        data: Prisma.patient_comorbidityUncheckedUpdateInput
    ) {
        return tx.patient_comorbidity.update({
            where: { id: recordId },
            data: { ...data, updated_at: new Date() },
            include: {
                diagnosis: true,
                employees: { select: { employee_id: true, first_name: true, last_name: true } },
            },
        });
    }

    async deletePatientComorbidity(tx: Prisma.TransactionClient, recordId: number) {
        return tx.patient_comorbidity.delete({ where: { id: recordId } });
    }

    async getCompleteClinicalDetails(encounterNo: string) {
        const encounter = await prisma.encounter.findUnique({
            where: { encounter_no: encounterNo },
            select: {
                encounter_no: true,
                patient_id: true,
                encounter_ts: true,
                status: true,
                patient_bio_data: { select: { patient_id: true } },
            },
        });

        if (!encounter) return null;

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