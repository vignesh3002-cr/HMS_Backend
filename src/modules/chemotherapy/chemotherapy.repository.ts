import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { ID_ENTITY } from "./chemotherapy.constants";
import { PlanFilterQuery, RegimenProtocolFilterQuery } from "./chemotherapy.types";

export class ChemotherapyRepository {

    // -----------------------------------------------------------------
    // chemotherapy_regimen_protocol / chemotherapy_regimen_protocol_items
    // -----------------------------------------------------------------

    async findCancerTypeById(cancerTypeId: string) {

        return prisma.cancer_types.findUnique({ where: { cancer_type_id: cancerTypeId } });
    }

    async findCancerSubtypeById(subtypeId: string) {

        return prisma.cancer_subtypes.findUnique({ where: { subtype_id: subtypeId } });

    }

    private protocolInclude = {
        chemotherapy_regimen_protocol_items: { where: { active_status: 1 }, orderBy: { drug_sequence: "asc" as const }, include: { medicine_master: true } },
        cancer_types: { select: { cancer_type_id: true, cancer_type: true } },
        cancer_subtypes: { select: { subtype_id: true, subtype_name: true } }
    } satisfies Prisma.chemotherapy_regimen_protocolInclude;

    async listRegimenProtocols(filters: RegimenProtocolFilterQuery) {

        return prisma.chemotherapy_regimen_protocol.findMany({
            where: {
                active_status: 1,
                // Generic protocols are globally available. Personalized
                // protocols are only ever shown to their owning organization
                // (organization_id filter) - an unauthenticated/global browse
                // never exposes them.
                ...(filters.organization_id
                    ? {
                        OR: [
                            { protocol_type: { not: "PERSONALIZED" } },
                            { organization_id: filters.organization_id }
                        ]
                    }
                    : { protocol_type: { not: "PERSONALIZED" } }),
                ...(filters.cancer_type_id ? { cancer_type_id: filters.cancer_type_id } : {}),
                // A null subtype_id on the protocol means "applies to the whole
                // cancer type" - so filtering by a specific subtype should
                // surface both subtype-specific AND type-wide protocols.
                ...(filters.subtype_id ? { OR: [{ subtype_id: filters.subtype_id }, { subtype_id: null }] } : {})
            },
            include: this.protocolInclude,
            orderBy: { regimen_code: "asc" }
        });

    }

    async findRegimenProtocolById(protocolId: string) {

        return prisma.chemotherapy_regimen_protocol.findUnique({
            where: { protocol_id: protocolId },
            include: this.protocolInclude
        });

    }

    async listDischargeMedicinesForProtocol(protocolId: string) {

        return prisma.chemotherapy_discharge_instructions.findMany({
            where: { protocol_id: protocolId, active_status: 1 },
            include: { medicine_master: true },
            orderBy: { drug_sequence: "asc" }
        });

    }

    async listDischargeMedicinesByProtocol(protocolId: string) {

        return prisma.chemotherapy_discharge_instructions.findMany({
            where: { protocol_id: protocolId, active_status: 1 },
            orderBy: { drug_sequence: "asc" },
            include: { medicine_master: true }
        });

    }

    async findRegimenProtocolByCode(cancerTypeId: string, subtypeId: string | null, regimenCode: string) {

        return prisma.chemotherapy_regimen_protocol.findFirst({
            where: { cancer_type_id: cancerTypeId, subtype_id: subtypeId, regimen_code: regimenCode }
        });

    }

    async generateRegimenProtocolId(tx: Prisma.TransactionClient) {
        return generateId(tx, ID_ENTITY.REGIMEN_PROTOCOL);
    }

    async generateRegimenProtocolItemId(tx: Prisma.TransactionClient) {
        return generateId(tx, ID_ENTITY.REGIMEN_PROTOCOL_ITEM);
    }

    async createRegimenProtocol(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_regimen_protocolUncheckedCreateInput) {
        return tx.chemotherapy_regimen_protocol.create({ data });
    }

    async updateRegimenProtocol(
        tx: Prisma.TransactionClient,
        protocolId: string,
        data: Prisma.chemotherapy_regimen_protocolUncheckedUpdateInput
    ) {
        return tx.chemotherapy_regimen_protocol.update({
            where: { protocol_id: protocolId },
            data: { ...data, updated_at: new Date() }
        });
    }

    async createRegimenProtocolItem(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_regimen_protocol_itemsUncheckedCreateInput) {
        return tx.chemotherapy_regimen_protocol_items.create({ data });
    }

    async updateRegimenProtocolItem(tx: Prisma.TransactionClient, protocolItemId: string, data: Prisma.chemotherapy_regimen_protocol_itemsUncheckedUpdateInput) {
        return tx.chemotherapy_regimen_protocol_items.update({
            where: { protocol_item_id: protocolItemId },
            data
        });
    }

    async findRegimenProtocolItemById(protocolItemId: string) {
        return prisma.chemotherapy_regimen_protocol_items.findUnique({ where: { protocol_item_id: protocolItemId } });
    }

    async deactivateRegimenProtocolItem(tx: Prisma.TransactionClient, protocolItemId: string) {
        return tx.chemotherapy_regimen_protocol_items.update({
            where: { protocol_item_id: protocolItemId },
            data: { active_status: 0 }
        });
    }

    // -----------------------------------------------------------------
    // Organization-specific personalized protocols (protocol hierarchy:
    // protocol -> days -> items -> dilutions)
    // -----------------------------------------------------------------

    private personalizedProtocolInclude = {
        chemotherapy_regimen_protocol_days: { where: { active_status: 1 }, orderBy: { day_number: "asc" as const } },
        chemotherapy_regimen_protocol_items: {
            where: { active_status: 1 },
            orderBy: { drug_sequence: "asc" as const },
            include: {
                medicine_master: true,
                chemotherapy_protocol_dilutions: { where: { active_status: 1 } }
            }
        },
        cancer_types: { select: { cancer_type_id: true, cancer_type: true } },
        cancer_subtypes: { select: { subtype_id: true, subtype_name: true } }
    } satisfies Prisma.chemotherapy_regimen_protocolInclude;

    async findRegimenProtocolByIdFull(protocolId: string) {
        return prisma.chemotherapy_regimen_protocol.findUnique({
            where: { protocol_id: protocolId },
            include: this.personalizedProtocolInclude
        });
    }

    async findPersonalizedProtocolById(protocolId: string, organizationId: string) {
        return prisma.chemotherapy_regimen_protocol.findFirst({
            where: { protocol_id: protocolId, organization_id: organizationId, protocol_type: "PERSONALIZED" },
            include: this.personalizedProtocolInclude
        });
    }

    async listPersonalizedProtocols(organizationId: string) {
        return prisma.chemotherapy_regimen_protocol.findMany({
            where: { organization_id: organizationId, protocol_type: "PERSONALIZED" },
            include: this.personalizedProtocolInclude,
            orderBy: { created_at: "desc" }
        });
    }

    async findHospitalById(hospitalId: string) {
        return prisma.hospital.findUnique({ where: { hospital_id: hospitalId } });
    }

    async countPlansUsingProtocol(protocolId: string) {
        return prisma.chemotherapy_plan.count({
            where: { source_protocol_id: protocolId, deleted_flag: false }
        });
    }

    async generateRegimenProtocolDayId(tx: Prisma.TransactionClient) {
        return generateId(tx, ID_ENTITY.REGIMEN_PROTOCOL_DAY);
    }

    async generateRegimenProtocolDilutionId(tx: Prisma.TransactionClient) {
        return generateId(tx, ID_ENTITY.REGIMEN_PROTOCOL_DILUTION);
    }

    async createRegimenProtocolDay(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_regimen_protocol_daysUncheckedCreateInput) {
        return tx.chemotherapy_regimen_protocol_days.create({ data });
    }

    async updateRegimenProtocolDay(tx: Prisma.TransactionClient, protocolDayId: string, data: Prisma.chemotherapy_regimen_protocol_daysUncheckedUpdateInput) {
        return tx.chemotherapy_regimen_protocol_days.updateMany({
            where: { protocol_day_id: protocolDayId },
            data: { ...data, updated_at: new Date() }
        });
    }

    async deactivateRegimenProtocolDay(tx: Prisma.TransactionClient, protocolDayId: string) {
        return tx.chemotherapy_regimen_protocol_days.updateMany({
            where: { protocol_day_id: protocolDayId },
            data: { active_status: 0, updated_at: new Date() }
        });
    }

    async findRegimenProtocolDayById(protocolDayId: string) {
        return prisma.chemotherapy_regimen_protocol_days.findFirst({ where: { protocol_day_id: protocolDayId } });
    }

    async findRegimenProtocolDaysByProtocolId(protocolId: string) {
        return prisma.chemotherapy_regimen_protocol_days.findMany({ where: { protocol_id: protocolId } });
    }

    async createRegimenProtocolDilution(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_protocol_dilutionsUncheckedCreateInput) {
        return tx.chemotherapy_protocol_dilutions.create({ data });
    }

    async updateRegimenProtocolDilution(tx: Prisma.TransactionClient, protocolDilutionId: string, data: Prisma.chemotherapy_protocol_dilutionsUncheckedUpdateInput) {
        return tx.chemotherapy_protocol_dilutions.update({
            where: { protocol_dilution_id: protocolDilutionId },
            data: { ...data, updated_at: new Date() }
        });
    }

    async deactivateRegimenProtocolDilution(tx: Prisma.TransactionClient, protocolDilutionId: string) {
        return tx.chemotherapy_protocol_dilutions.update({
            where: { protocol_dilution_id: protocolDilutionId },
            data: { active_status: 0, updated_at: new Date() }
        });
    }

    async findRegimenProtocolDilutionById(protocolDilutionId: string) {
        return prisma.chemotherapy_protocol_dilutions.findUnique({ where: { protocol_dilution_id: protocolDilutionId } });
    }

    // -----------------------------------------------------------------
    // Supporting entity lookups (existence checks only - these tables
    // belong to other modules)
    // -----------------------------------------------------------------

    async findMedicineById(medicineId: string) {

        return prisma.medicine_master.findUnique({ where: { medicine_id: medicineId } });

    }

    async findActiveMedicineById(medicineId: string) {

        return prisma.medicine_master.findFirst({ where: { medicine_id: medicineId, is_active: true } });

    }

    async findDepartmentById(departmentId: string) {

        return prisma.department_master.findUnique({ where: { department_id: departmentId } });

    }

    async findEmployeeById(employeeId: string) {

        return prisma.employees.findUnique({ where: { employee_id: employeeId } });

    }

    async findBranchById(branchId: string) {

        return prisma.branch.findUnique({ where: { branch_id: branchId } });

    }

    async findDiagnosisById(diagnosisId: string) {

        return prisma.diagnosis.findUnique({ where: { diagnosis_id: diagnosisId } });

    }

    async findPatientById(patientId: string) {

        return prisma.patient_bio_data.findUnique({ where: { patient_id: patientId } });

    }

    async findMostRecentPatientHistory(patientId: string) {

        return prisma.patient_history.findFirst({
            where: { patient_id: patientId },
            orderBy: { visit_date: "desc" }
        });

    }

    async findPatientHistoryById(patientHistoryId: string) {

        return prisma.patient_history.findUnique({ where: { patient_history_id: patientHistoryId } });

    }

    async createPatientHistory(tx: Prisma.TransactionClient, data: Prisma.patient_historyUncheckedCreateInput) {

        return tx.patient_history.create({ data });

    }

    // -----------------------------------------------------------------
    // chemotherapy_plan
    // -----------------------------------------------------------------

    async generatePlanId(tx: Prisma.TransactionClient) {

        return generateId(tx, ID_ENTITY.PLAN);

    }

    async createPlan(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_planUncheckedCreateInput) {

        return tx.chemotherapy_plan.create({ data });

    }

    async updatePlan(
        tx: Prisma.TransactionClient,
        planId: string,
        data: Prisma.chemotherapy_planUncheckedUpdateInput
    ) {

        return tx.chemotherapy_plan.update({
            where: { chemotherapy_plan_id: planId },
            data: { ...data, updated_at: new Date() }
        });

    }

    private planInclude = {
        chemotherapy_plan_items: {
            where: { active_status: 1 },
            include: { medicine_master: true }
        },
        chemotherapy_cycle: { where: { active_status: 1 }, orderBy: { cycle_number: "asc" as const } },
        patient_bio_data: {
            select: { patient_id: true, patient_first_name: true, patient_last_name: true }
        },
        employees: { select: { employee_id: true, first_name: true, last_name: true } },
        oncology_staging_detail: {
            include: { derived_fields: true, cancer_types: true, cancer_subtypes: true }
        },
        chemotherapy_regimen_protocol: {
            select: { protocol_id: true, regimen_code: true, regimen_name: true }
        }
    } satisfies Prisma.chemotherapy_planInclude;

    async findPlanById(planId: string) {

        return prisma.chemotherapy_plan.findUnique({
            where: { chemotherapy_plan_id: planId },
            include: this.planInclude
        });

    }

    async findPlanForUpdate(tx: Prisma.TransactionClient, planId: string) {

        return tx.chemotherapy_plan.findUnique({ where: { chemotherapy_plan_id: planId } });

    }

    async listPlans(filters: PlanFilterQuery) {

        const page = filters.page && filters.page > 0 ? filters.page : 1;
        const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

        const where: Prisma.chemotherapy_planWhereInput = {
            active_status: 1,
            ...(filters.patient_id ? { patient_id: filters.patient_id } : {}),
            ...(filters.diagnosis_id ? { diagnosis_id: filters.diagnosis_id } : {}),
            ...(filters.employee_id ? { employee_id: filters.employee_id } : {}),
            ...(filters.branch_id ? { branch_id: filters.branch_id } : {}),
            ...(filters.department_id ? { department_id: filters.department_id } : {}),
            ...(filters.status ? { treatment_status: filters.status } : {}),
            ...(filters.date_from || filters.date_to
                ? {
                    treatment_start_date: {
                        ...(filters.date_from ? { gte: new Date(filters.date_from) } : {}),
                        ...(filters.date_to ? { lte: new Date(filters.date_to) } : {})
                    }
                }
                : {})
        };

        const [rows, total] = await Promise.all([
            prisma.chemotherapy_plan.findMany({
                where,
                include: this.planInclude,
                orderBy: { created_at: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.chemotherapy_plan.count({ where })
        ]);

        return { rows, total, page, limit };

    }

    async findActiveBranchMappingsForUser(userId: string) {

        return prisma.user_branch_mapping.findMany({
            where: { user_id: userId, status: 1 },
            select: { branch_id: true }
        });

    }

    // Latest active plan for a patient, newest first. When branchIds is
    // null (top-level admin) every branch is visible.
    async findLatestPlanForPatient(patientId: string, branchIds: string[] | null) {

        return prisma.chemotherapy_plan.findFirst({
            where: {
                active_status: 1,
                patient_id: patientId,
                ...(branchIds ? { branch_id: { in: branchIds } } : {})
            },
            include: this.planInclude,
            orderBy: { created_at: "desc" }
        });

    }

    // -----------------------------------------------------------------
    // chemotherapy_plan_items
    // -----------------------------------------------------------------

    async generatePlanItemId(tx: Prisma.TransactionClient) {

        return generateId(tx, ID_ENTITY.PLAN_ITEM);

    }

    async createPlanItem(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_plan_itemsUncheckedCreateInput) {

        return tx.chemotherapy_plan_items.create({ data });

    }

    async findPlanItemById(planItemId: string) {

        return prisma.chemotherapy_plan_items.findUnique({ where: { chemotherapy_plan_item_id: planItemId } });

    }

    async updatePlanItem(
        tx: Prisma.TransactionClient,
        planItemId: string,
        data: Prisma.chemotherapy_plan_itemsUncheckedUpdateInput
    ) {

        return tx.chemotherapy_plan_items.update({
            where: { chemotherapy_plan_item_id: planItemId },
            data: { ...data, updated_at: new Date() }
        });

    }

    async deactivatePlanItem(tx: Prisma.TransactionClient, planItemId: string) {

        return tx.chemotherapy_plan_items.update({
            where: { chemotherapy_plan_item_id: planItemId },
            data: { active_status: 0, updated_at: new Date() }
        });

    }

    // -----------------------------------------------------------------
    // chemotherapy_cycle
    // -----------------------------------------------------------------

    async generateCycleId(tx: Prisma.TransactionClient) {

        return generateId(tx, ID_ENTITY.CYCLE);

    }

    async createCycle(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_cycleUncheckedCreateInput) {

        return tx.chemotherapy_cycle.create({ data });

    }

    private cycleInclude = {
        chemotherapy_administration: { where: { active_status: 1 } },
        chemotherapy_vitals: { where: { active_status: 1 } },
        chemotherapy_adverse_event: { where: { active_status: 1 } },
        chemotherapy_lab_review: { where: { active_status: 1 } },
        chemotherapy_followup: { where: { active_status: 1 } }
    } satisfies Prisma.chemotherapy_cycleInclude;

    async findCycleById(cycleId: string) {

        return prisma.chemotherapy_cycle.findUnique({
            where: { chemotherapy_cycle_id: cycleId },
            include: this.cycleInclude
        });

    }

    async findCycleForUpdate(tx: Prisma.TransactionClient, cycleId: string) {

        return tx.chemotherapy_cycle.findUnique({ where: { chemotherapy_cycle_id: cycleId } });

    }

    async listCyclesForPlan(planId: string) {

        return prisma.chemotherapy_cycle.findMany({
            where: { chemotherapy_plan_id: planId, active_status: 1 },
            include: this.cycleInclude,
            orderBy: { cycle_number: "asc" }
        });

    }

    async updateCycle(
        tx: Prisma.TransactionClient,
        cycleId: string,
        data: Prisma.chemotherapy_cycleUncheckedUpdateInput
    ) {

        return tx.chemotherapy_cycle.update({
            where: { chemotherapy_cycle_id: cycleId },
            data: { ...data, updated_at: new Date() }
        });

    }

    // -----------------------------------------------------------------
    // chemotherapy_administration
    // -----------------------------------------------------------------

    async generateAdministrationId(tx: Prisma.TransactionClient) {

        return generateId(tx, ID_ENTITY.ADMINISTRATION);

    }

    async createAdministration(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_administrationUncheckedCreateInput) {

        return tx.chemotherapy_administration.create({ data });

    }

    async countAdministrationsForCycle(cycleId: string) {

        return prisma.chemotherapy_administration.count({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 }
        });

    }

    async countAdministrationsForPlan(planId: string) {

        return prisma.chemotherapy_administration.count({
            where: {
                active_status: 1,
                chemotherapy_cycle: { chemotherapy_plan_id: planId }
            }
        });

    }

    async listAdministrationsForCycle(cycleId: string) {

        return prisma.chemotherapy_administration.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { administration_date: "asc" }
        });

    }

    // -----------------------------------------------------------------
    // chemotherapy_vitals / chemotherapy_adverse_event /
    // chemotherapy_lab_review / chemotherapy_followup - all append-only,
    // tied 1:many to a cycle.
    // -----------------------------------------------------------------

    async generateVitalsId(tx: Prisma.TransactionClient) {
        return generateId(tx, ID_ENTITY.VITALS);
    }

    async createVitals(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_vitalsUncheckedCreateInput) {
        return tx.chemotherapy_vitals.create({ data });
    }

    async listVitalsForCycle(cycleId: string) {
        return prisma.chemotherapy_vitals.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { recorded_at: "asc" }
        });
    }

    async generateAdverseEventId(tx: Prisma.TransactionClient) {
        return generateId(tx, ID_ENTITY.ADVERSE_EVENT);
    }

    async createAdverseEvent(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_adverse_eventUncheckedCreateInput) {
        return tx.chemotherapy_adverse_event.create({ data });
    }

    async listAdverseEventsForCycle(cycleId: string) {
        return prisma.chemotherapy_adverse_event.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { event_date: "asc" }
        });
    }

    async generateLabReviewId(tx: Prisma.TransactionClient) {
        return generateId(tx, ID_ENTITY.LAB_REVIEW);
    }

    async createLabReview(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_lab_reviewUncheckedCreateInput) {
        return tx.chemotherapy_lab_review.create({ data });
    }

    async listLabReviewsForCycle(cycleId: string) {
        return prisma.chemotherapy_lab_review.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { review_date: "asc" }
        });
    }

    async generateFollowupId(tx: Prisma.TransactionClient) {
        return generateId(tx, ID_ENTITY.FOLLOWUP);
    }

    async createFollowup(tx: Prisma.TransactionClient, data: Prisma.chemotherapy_followupUncheckedCreateInput) {
        return tx.chemotherapy_followup.create({ data });
    }

    async listFollowupsForCycle(cycleId: string) {
        return prisma.chemotherapy_followup.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { followup_date: "asc" }
        });
    }

    async listSupportiveMedicines() {
        return prisma.medicine_master.findMany({
            where: {
                is_active: true,
                medicine_category: { not: "Chemotherapy" }
            },
            select: {
                medicine_id: true,
                medicine_name: true,
                generic_name: true,
                medicine_category: true,
                medicine_type: true,
                dosage_form: true,
                unit: true,
                strength: true,
                route: true,
            },
            orderBy: { medicine_name: "asc" }
        });
    }

}
