"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultationRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class ConsultationRepository {
    // ---------------- Master data ----------------
    async getImmunizations(query) {
        const where = {};
        if (query.isActive !== undefined)
            where.is_active = query.isActive;
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } }
            ];
        }
        return prisma_1.default.immunization_master.findMany({ where, orderBy: { name: "asc" } });
    }
    async findImmunizationByCode(code) {
        return prisma_1.default.immunization_master.findUnique({ where: { code } });
    }
    async findImmunizationByName(name) {
        return prisma_1.default.immunization_master.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    }
    async createImmunization(data) {
        return prisma_1.default.immunization_master.create({ data });
    }
    async getDrugConsumptions(query) {
        const where = {};
        if (query.isActive !== undefined)
            where.is_active = query.isActive;
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } }
            ];
        }
        return prisma_1.default.drug_consumption_master.findMany({ where, orderBy: { name: "asc" } });
    }
    async findDrugConsumptionByCode(code) {
        return prisma_1.default.drug_consumption_master.findUnique({ where: { code } });
    }
    async findDrugConsumptionByName(name) {
        return prisma_1.default.drug_consumption_master.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    }
    async createDrugConsumption(data) {
        return prisma_1.default.drug_consumption_master.create({ data });
    }
    // ---------------- Personal history ----------------
    async findPersonalHistoryByEncounter(encounterNo) {
        return prisma_1.default.patient_personal_history.findUnique({ where: { encounter_no: encounterNo } });
    }
    async createPersonalHistory(data) {
        return prisma_1.default.patient_personal_history.create({ data });
    }
    async updatePersonalHistory(id, data) {
        return prisma_1.default.patient_personal_history.update({ where: { id }, data });
    }
    // ---------------- Encounter reports ----------------
    async findReportsByEncounter(encounterNo) {
        return prisma_1.default.encounter_report.findMany({
            where: { encounter_no: encounterNo },
            include: { lab_test_master: true },
            orderBy: { created_at: "desc" }
        });
    }
    async findReportById(encounterReportId) {
        return prisma_1.default.encounter_report.findUnique({ where: { encounter_report_id: encounterReportId } });
    }
    async createReport(data) {
        return prisma_1.default.encounter_report.create({ data, include: { lab_test_master: true } });
    }
    async updateReport(encounterReportId, data) {
        return prisma_1.default.encounter_report.update({
            where: { encounter_report_id: encounterReportId },
            data,
            include: { lab_test_master: true }
        });
    }
    async deleteReport(encounterReportId) {
        return prisma_1.default.encounter_report.delete({ where: { encounter_report_id: encounterReportId } });
    }
    // ---------------- Existence checks ----------------
    async findEncounterByNumber(encounterNo) {
        return prisma_1.default.encounter.findUnique({ where: { encounter_no: encounterNo } });
    }
    async findLabTestById(labTestId) {
        return prisma_1.default.lab_test_master.findUnique({ where: { lab_test_id: labTestId } });
    }
}
exports.ConsultationRepository = ConsultationRepository;
