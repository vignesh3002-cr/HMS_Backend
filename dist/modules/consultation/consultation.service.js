"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultationService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const consultation_repository_1 = require("./consultation.repository");
const consultation_constants_1 = require("./consultation.constants");
const repository = new consultation_repository_1.ConsultationRepository();
function slugCode(prefix, name) {
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
async function uniqueCode(prefix, name, exists) {
    const base = slugCode(prefix, name);
    let code = base;
    for (let n = 2; await exists(code); n++) {
        code = `${base}-${n}`;
    }
    return code;
}
class ConsultationService {
    // ---------------- Master data ----------------
    async listImmunizations(query) {
        return repository.getImmunizations(query);
    }
    async createCustomImmunization(data, createdBy) {
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
    async listDrugConsumptions(query) {
        return repository.getDrugConsumptions(query);
    }
    async createCustomDrugConsumption(data, createdBy) {
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
    async listGeneralExaminationFindings(query) {
        return repository.getGeneralExaminationFindings(query);
    }
    async createCustomGeneralExaminationFinding(data, createdBy) {
        const name = (data.name ?? "").trim();
        if (!name) {
            throw new Error("Finding name is required");
        }
        const core = consultation_constants_1.GENERAL_EXAMINATION_CORE_FINDINGS.find((finding) => finding.toLowerCase() === name.toLowerCase());
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
    async listTreatmentTypes(query) {
        return repository.getTreatmentTypes(query);
    }
    async createCustomTreatmentType(data, createdBy) {
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
        return consultation_constants_1.DIET_TYPES;
    }
    listMolecularTestOptions() {
        return consultation_constants_1.MOLECULAR_TESTS;
    }
    // ---------------- Personal history ----------------
    async getPersonalHistory(encounterNo) {
        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }
        return repository.findPersonalHistoryByEncounter(encounterNo);
    }
    async upsertPersonalHistory(encounterNo, payload, actingUserId) {
        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }
        const existing = await repository.findPersonalHistoryByEncounter(encounterNo);
        const data = {
            immunization: payload.immunization === undefined
                ? undefined
                : (payload.immunization === null ? client_1.Prisma.JsonNull : payload.immunization),
            drug_consumption: payload.drug_consumption === undefined
                ? undefined
                : (payload.drug_consumption === null ? client_1.Prisma.JsonNull : payload.drug_consumption),
            diet_type: payload.diet_type === undefined ? undefined : payload.diet_type
        };
        if (existing) {
            return repository.updatePersonalHistory(existing.id, {
                ...data,
                updated_at: new Date()
            });
        }
        const newId = await prisma_1.default.$transaction((tx) => (0, idGenerator_1.generateId)(tx, "PERSONAL_HISTORY"));
        return repository.createPersonalHistory({
            personal_history_id: newId,
            encounter_no: encounterNo,
            immunization: payload.immunization == null ? client_1.Prisma.JsonNull : payload.immunization,
            drug_consumption: payload.drug_consumption == null ? client_1.Prisma.JsonNull : payload.drug_consumption,
            diet_type: payload.diet_type ?? null,
            created_by: actingUserId
        });
    }
    // ---------------- Encounter reports ----------------
    async listReports(encounterNo) {
        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }
        return repository.findReportsByEncounter(encounterNo);
    }
    async addReport(encounterNo, dto, actingUserId) {
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
        }
        else if (!testName) {
            throw new Error("Select a lab test or type the test name");
        }
        const newId = await prisma_1.default.$transaction((tx) => (0, idGenerator_1.generateId)(tx, "ENCOUNTER_REPORT"));
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
    async updateReport(encounterReportId, dto, actingUserId) {
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
    async listMolecularTests(encounterNo) {
        const encounter = await repository.findEncounterByNumber(encounterNo);
        if (!encounter) {
            throw new Error("Encounter not found");
        }
        return repository.findMolecularTestsByEncounter(encounterNo);
    }
    async addMolecularTest(encounterNo, dto, actingUserId) {
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
        const newId = await prisma_1.default.$transaction((tx) => (0, idGenerator_1.generateId)(tx, "ENCOUNTER_MOLECULAR_TEST"));
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
    async updateMolecularTest(encounterMolecularTestId, dto) {
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
    async removeMolecularTest(encounterMolecularTestId) {
        const existing = await repository.findMolecularTestById(encounterMolecularTestId);
        if (!existing) {
            throw new Error("Molecular test not found");
        }
        await repository.deleteMolecularTest(encounterMolecularTestId);
        return { encounter_molecular_test_id: encounterMolecularTestId };
    }
    async removeReport(encounterReportId) {
        const existing = await repository.findReportById(encounterReportId);
        if (!existing) {
            throw new Error("Report not found");
        }
        await repository.deleteReport(encounterReportId);
        return { encounter_report_id: encounterReportId };
    }
}
exports.ConsultationService = ConsultationService;
