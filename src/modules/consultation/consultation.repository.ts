import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";

export class ConsultationRepository {

    // ---------------- Master data ----------------

    async getImmunizations(query: { search?: string; isActive?: boolean }) {

        const where: Prisma.immunization_masterWhereInput = {};
        if (query.isActive !== undefined) where.is_active = query.isActive;
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } }
            ];
        }

        return prisma.immunization_master.findMany({ where, orderBy: { name: "asc" } });

    }

    async findImmunizationByCode(code: string) {

        return prisma.immunization_master.findUnique({ where: { code } });

    }

    async findImmunizationByName(name: string) {

        return prisma.immunization_master.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });

    }

    async createImmunization(data: Prisma.immunization_masterUncheckedCreateInput) {

        return prisma.immunization_master.create({ data });

    }

    async getDrugConsumptions(query: { search?: string; isActive?: boolean }) {

        const where: Prisma.drug_consumption_masterWhereInput = {};
        if (query.isActive !== undefined) where.is_active = query.isActive;
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } }
            ];
        }

        return prisma.drug_consumption_master.findMany({ where, orderBy: { name: "asc" } });

    }

    async findDrugConsumptionByCode(code: string) {

        return prisma.drug_consumption_master.findUnique({ where: { code } });

    }

    async findDrugConsumptionByName(name: string) {

        return prisma.drug_consumption_master.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });

    }

    async createDrugConsumption(data: Prisma.drug_consumption_masterUncheckedCreateInput) {

        return prisma.drug_consumption_master.create({ data });

    }

    // ---------------- Personal history ----------------

    async findPersonalHistoryByEncounter(encounterNo: string) {

        return prisma.patient_personal_history.findUnique({ where: { encounter_no: encounterNo } });

    }

    async createPersonalHistory(data: Prisma.patient_personal_historyUncheckedCreateInput) {

        return prisma.patient_personal_history.create({ data });

    }

    async updatePersonalHistory(id: bigint, data: Prisma.patient_personal_historyUncheckedUpdateInput) {

        return prisma.patient_personal_history.update({ where: { id }, data });

    }

    // ---------------- Encounter reports ----------------

    async findReportsByEncounter(encounterNo: string) {

        return prisma.encounter_report.findMany({
            where: { encounter_no: encounterNo },
            include: { lab_test_master: true },
            orderBy: { created_at: "desc" }
        });

    }

    async findReportById(encounterReportId: string) {

        return prisma.encounter_report.findUnique({ where: { encounter_report_id: encounterReportId } });

    }

    async createReport(data: Prisma.encounter_reportUncheckedCreateInput) {

        return prisma.encounter_report.create({ data, include: { lab_test_master: true } });

    }

    async updateReport(encounterReportId: string, data: Prisma.encounter_reportUncheckedUpdateInput) {

        return prisma.encounter_report.update({
            where: { encounter_report_id: encounterReportId },
            data,
            include: { lab_test_master: true }
        });

    }

    async deleteReport(encounterReportId: string) {

        return prisma.encounter_report.delete({ where: { encounter_report_id: encounterReportId } });

    }

    // ---------------- Existence checks ----------------

    async findEncounterByNumber(encounterNo: string) {

        return prisma.encounter.findUnique({ where: { encounter_no: encounterNo } });

    }

    async findLabTestById(labTestId: string) {

        return prisma.lab_test_master.findUnique({ where: { lab_test_id: labTestId } });

    }

}
