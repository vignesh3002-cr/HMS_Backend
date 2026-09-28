import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { ConsultationRepository } from "./consultation.repository";
import { CreateCustomMasterDTO, EncounterReportDTO, MasterListQuery, PersonalHistoryPayload } from "./consultation.types";
import { DIET_TYPES } from "./consultation.constants";

const repository = new ConsultationRepository();

function slugCode(prefix: string, name: string): string {
    const slug = name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    return `${prefix}-${slug || Date.now().toString(36).toUpperCase()}`;
}

export class ConsultationService {

    // ---------------- Master data ----------------

    async listImmunizations(query: MasterListQuery) {
        return repository.getImmunizations(query);
    }

    async createCustomImmunization(data: CreateCustomMasterDTO, createdBy?: string | null) {

        const name = (data.name ?? "").trim();
        if (!name) {
            throw new Error("Immunization name is required");
        }

        const existing = await repository.findImmunizationByName(name);
        if (existing) {
            return existing;
        }

        return repository.createImmunization({
            code: slugCode("IMM", name),
            name,
            description: data.description ?? null,
            is_active: true,
            created_by: createdBy ?? null
        });

    }

    async listDrugConsumptions(query: MasterListQuery) {
        return repository.getDrugConsumptions(query);
    }

    async createCustomDrugConsumption(data: CreateCustomMasterDTO, createdBy?: string | null) {

        const name = (data.name ?? "").trim();
        if (!name) {
            throw new Error("Drug consumption name is required");
        }

        const existing = await repository.findDrugConsumptionByName(name);
        if (existing) {
            return existing;
        }

        const sanitized = name
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 30);

        return repository.createDrugConsumption({
            code: `DRG-${sanitized || Date.now().toString(36).toUpperCase()}`,
            name,
            description: data.description ?? null,
            is_active: true,
            created_by: createdBy ?? null
        });

    }

    listDietTypes() {
        return DIET_TYPES;
    }

    // ---------------- Personal history ----------------

    async getPersonalHistory(encounterNo: string) {

        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }

        return repository.findPersonalHistoryByEncounter(encounterNo);

    }

    async upsertPersonalHistory(encounterNo: string, payload: PersonalHistoryPayload, actingUserId: string) {

        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }

        const existing = await repository.findPersonalHistoryByEncounter(encounterNo);

        const data = {
            immunization: payload.immunization === undefined
                ? undefined
                : (payload.immunization === null ? Prisma.JsonNull : payload.immunization),
            drug_consumption: payload.drug_consumption === undefined
                ? undefined
                : (payload.drug_consumption === null ? Prisma.JsonNull : payload.drug_consumption),
            diet_type: payload.diet_type === undefined ? undefined : payload.diet_type
        };

        if (existing) {
            return repository.updatePersonalHistory(existing.id, {
                ...data,
                updated_at: new Date()
            });
        }

        const newId = await prisma.$transaction((tx) => generateId(tx, "PERSONAL_HISTORY"));

        return repository.createPersonalHistory({
            personal_history_id: newId,
            encounter_no: encounterNo,
            immunization: payload.immunization == null ? Prisma.JsonNull : (payload.immunization as Prisma.InputJsonValue),
            drug_consumption: payload.drug_consumption == null ? Prisma.JsonNull : (payload.drug_consumption as Prisma.InputJsonValue),
            diet_type: payload.diet_type ?? null,
            created_by: actingUserId
        });

    }

    // ---------------- Encounter reports ----------------

    async listReports(encounterNo: string) {

        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }

        return repository.findReportsByEncounter(encounterNo);

    }

    async addReport(encounterNo: string, dto: EncounterReportDTO, actingUserId: string) {

        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }

        const labTest = await repository.findLabTestById(dto.lab_test_id);
        if (!labTest) {
            throw new Error("Lab test not found");
        }

        const newId = await prisma.$transaction((tx) => generateId(tx, "ENCOUNTER_REPORT"));

        return repository.createReport({
            encounter_report_id: newId,
            encounter_no: encounterNo,
            lab_test_id: dto.lab_test_id,
            report_completed_date: dto.report_completed_date ? new Date(dto.report_completed_date) : null,
            result: dto.result ?? null,
            impression: dto.impression ?? null,
            created_by: actingUserId
        });

    }

    async updateReport(encounterReportId: string, dto: Partial<EncounterReportDTO>, actingUserId: string) {

        const existing = await repository.findReportById(encounterReportId);
        if (!existing) {
            throw new Error("Report not found");
        }

        if (dto.lab_test_id && dto.lab_test_id !== existing.lab_test_id) {
            const labTest = await repository.findLabTestById(dto.lab_test_id);
            if (!labTest) {
                throw new Error("Lab test not found");
            }
        }

        return repository.updateReport(encounterReportId, {
            ...(dto.lab_test_id !== undefined ? { lab_test_id: dto.lab_test_id } : {}),
            ...(dto.report_completed_date !== undefined ? { report_completed_date: dto.report_completed_date ? new Date(dto.report_completed_date) : null } : {}),
            ...(dto.result !== undefined ? { result: dto.result } : {}),
            ...(dto.impression !== undefined ? { impression: dto.impression } : {}),
            updated_at: new Date()
        });

    }

    async removeReport(encounterReportId: string) {

        const existing = await repository.findReportById(encounterReportId);
        if (!existing) {
            throw new Error("Report not found");
        }

        await repository.deleteReport(encounterReportId);

        return { encounter_report_id: encounterReportId };

    }

}
