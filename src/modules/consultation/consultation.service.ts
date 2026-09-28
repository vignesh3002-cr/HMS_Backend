import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { ConsultationRepository } from "./consultation.repository";
import { CreateCustomMasterDTO, EncounterMolecularTestDTO, EncounterReportDTO, MasterListQuery, PersonalHistoryPayload } from "./consultation.types";
import { DIET_TYPES, GENERAL_EXAMINATION_CORE_FINDINGS, MOLECULAR_TESTS } from "./consultation.constants";

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

// Different names can slug to the same code ("Hep B" / "Hep-B"); suffix
// -2, -3, ... so a new option never collides with the unique code.
async function uniqueCode(prefix: string, name: string, exists: (code: string) => Promise<unknown>): Promise<string> {
    const base = slugCode(prefix, name);
    let code = base;
    for (let n = 2; await exists(code); n++) {
        code = `${base}-${n}`;
    }
    return code;
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
            code: await uniqueCode("IMM", name, (code) => repository.findImmunizationByCode(code)),
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

        return repository.createDrugConsumption({
            code: await uniqueCode("DRG", name, (code) => repository.findDrugConsumptionByCode(code)),
            name,
            description: data.description ?? null,
            is_active: true,
            created_by: createdBy ?? null
        });

    }

    async listGeneralExaminationFindings(query: MasterListQuery) {
        return repository.getGeneralExaminationFindings(query);
    }

    async createCustomGeneralExaminationFinding(data: CreateCustomMasterDTO, createdBy?: string | null) {

        const name = (data.name ?? "").trim();
        if (!name) {
            throw new Error("Finding name is required");
        }

        const core = GENERAL_EXAMINATION_CORE_FINDINGS.find((finding) => finding.toLowerCase() === name.toLowerCase());
        if (core) {
            throw new Error(`${core} is already a General Examination finding`);
        }

        const existing = await repository.findGeneralExaminationFindingByName(name);
        if (existing) {
            return existing;
        }

        return repository.createGeneralExaminationFinding({
            code: await uniqueCode("GEX", name, (code) => repository.findGeneralExaminationFindingByCode(code)),
            name,
            display_order: await repository.nextGeneralExaminationFindingDisplayOrder(),
            description: data.description ?? null,
            is_active: true,
            created_by: createdBy ?? null
        });

    }

    async listTreatmentTypes(query: MasterListQuery) {
        return repository.getTreatmentTypes(query);
    }

    async createCustomTreatmentType(data: CreateCustomMasterDTO, createdBy?: string | null) {

        const name = (data.name ?? "").trim();
        if (!name) {
            throw new Error("Treatment type name is required");
        }

        const existing = await repository.findTreatmentTypeByName(name);
        if (existing) {
            return existing;
        }

        return repository.createTreatmentType({
            code: await uniqueCode("TRT", name, (code) => repository.findTreatmentTypeByCode(code)),
            name,
            display_order: await repository.nextTreatmentTypeDisplayOrder(),
            description: data.description ?? null,
            is_active: true,
            created_by: createdBy ?? null
        });

    }

    listDietTypes() {
        return DIET_TYPES;
    }

    listMolecularTestOptions() {
        return MOLECULAR_TESTS;
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

        // A test that isn't in lab_test_master is typed by hand and kept on
        // this report only (test_name); the master is never changed here.
        const testName = dto.test_name?.trim() || null;

        if (dto.lab_test_id) {
            const labTest = await repository.findLabTestById(dto.lab_test_id);
            if (!labTest) {
                throw new Error("Lab test not found");
            }
        } else if (!testName) {
            throw new Error("Select a lab test or type the test name");
        }

        const newId = await prisma.$transaction((tx) => generateId(tx, "ENCOUNTER_REPORT"));

        return repository.createReport({
            encounter_report_id: newId,
            encounter_no: encounterNo,
            lab_test_id: dto.lab_test_id || null,
            test_name: dto.lab_test_id ? null : testName,
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

        const testName = dto.test_name?.trim() || null;

        return repository.updateReport(encounterReportId, {
            // A report is for either a master test or a typed one, never both.
            ...(dto.lab_test_id ? { lab_test_id: dto.lab_test_id, test_name: null } : {}),
            ...(!dto.lab_test_id && testName ? { lab_test_id: null, test_name: testName } : {}),
            ...(dto.report_completed_date !== undefined ? { report_completed_date: dto.report_completed_date ? new Date(dto.report_completed_date) : null } : {}),
            ...(dto.result !== undefined ? { result: dto.result } : {}),
            ...(dto.impression !== undefined ? { impression: dto.impression } : {}),
            updated_at: new Date()
        });

    }

    // ---------------- Encounter molecular tests ----------------
    // Consultation > Patient Details > Molecular Testing: one row per test
    // per visit (test + date + result + impression), like Reports (Previous).

    async listMolecularTests(encounterNo: string) {

        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }

        return repository.findMolecularTestsByEncounter(encounterNo);

    }

    async addMolecularTest(encounterNo: string, dto: EncounterMolecularTestDTO, actingUserId: string) {

        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }

        const testName = (dto.test_name ?? "").trim();
        if (!testName) {
            throw new Error("Select or type a molecular test");
        }

        const duplicate = await repository.findMolecularTestByName(encounterNo, testName);
        if (duplicate) {
            throw new Error(`${duplicate.test_name} is already recorded for this visit`);
        }

        const newId = await prisma.$transaction((tx) => generateId(tx, "ENCOUNTER_MOLECULAR_TEST"));

        return repository.createMolecularTest({
            encounter_molecular_test_id: newId,
            encounter_no: encounterNo,
            test_name: testName,
            test_date: dto.test_date ? new Date(dto.test_date) : null,
            result: dto.result ?? null,
            impression: dto.impression ?? null,
            created_by: actingUserId
        });

    }

    async updateMolecularTest(encounterMolecularTestId: string, dto: Partial<EncounterMolecularTestDTO>) {

        const existing = await repository.findMolecularTestById(encounterMolecularTestId);
        if (!existing) {
            throw new Error("Molecular test not found");
        }

        const testName = dto.test_name?.trim();

        if (testName && testName.toLowerCase() !== existing.test_name.toLowerCase()) {
            const duplicate = await repository.findMolecularTestByName(existing.encounter_no, testName);
            if (duplicate) {
                throw new Error(`${duplicate.test_name} is already recorded for this visit`);
            }
        }

        return repository.updateMolecularTest(encounterMolecularTestId, {
            ...(testName ? { test_name: testName } : {}),
            ...(dto.test_date !== undefined ? { test_date: dto.test_date ? new Date(dto.test_date) : null } : {}),
            ...(dto.result !== undefined ? { result: dto.result } : {}),
            ...(dto.impression !== undefined ? { impression: dto.impression } : {}),
            updated_at: new Date()
        });

    }

    async removeMolecularTest(encounterMolecularTestId: string) {

        const existing = await repository.findMolecularTestById(encounterMolecularTestId);
        if (!existing) {
            throw new Error("Molecular test not found");
        }

        await repository.deleteMolecularTest(encounterMolecularTestId);

        return { encounter_molecular_test_id: encounterMolecularTestId };

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
