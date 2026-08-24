"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChemotherapyRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const chemotherapy_constants_1 = require("./chemotherapy.constants");
class ChemotherapyRepository {
    // -----------------------------------------------------------------
    // chemotherapy_regimen_protocol / chemotherapy_regimen_protocol_items
    // -----------------------------------------------------------------
    async findCancerTypeById(cancerTypeId) {
        return prisma_1.default.cancer_types.findUnique({ where: { cancer_type_id: cancerTypeId } });
    }
    async findCancerSubtypeById(subtypeId) {
        return prisma_1.default.cancer_subtypes.findUnique({ where: { subtype_id: subtypeId } });
    }
    protocolInclude = {
        chemotherapy_regimen_protocol_items: { where: { active_status: 1 }, orderBy: { drug_sequence: "asc" }, include: { medicine_master: true } },
        cancer_types: { select: { cancer_type_id: true, cancer_type: true } },
        cancer_subtypes: { select: { subtype_id: true, subtype_name: true } }
    };
    async listRegimenProtocols(filters) {
        return prisma_1.default.chemotherapy_regimen_protocol.findMany({
            where: {
                active_status: 1,
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
    async findRegimenProtocolById(protocolId) {
        return prisma_1.default.chemotherapy_regimen_protocol.findUnique({
            where: { protocol_id: protocolId },
            include: this.protocolInclude,
        });
    }
    async findRegimenProtocolByCode(cancerTypeId, subtypeId, regimenCode) {
        return prisma_1.default.chemotherapy_regimen_protocol.findFirst({
            where: { cancer_type_id: cancerTypeId, subtype_id: subtypeId, regimen_code: regimenCode }
        });
    }
    async generateRegimenProtocolId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.REGIMEN_PROTOCOL);
    }
    async generateRegimenProtocolItemId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.REGIMEN_PROTOCOL_ITEM);
    }
    async createRegimenProtocol(tx, data) {
        return tx.chemotherapy_regimen_protocol.create({ data });
    }
    async updateRegimenProtocol(tx, protocolId, data) {
        return tx.chemotherapy_regimen_protocol.update({
            where: { protocol_id: protocolId },
            data: { ...data, updated_at: new Date() }
        });
    }
    async createRegimenProtocolItem(tx, data) {
        return tx.chemotherapy_regimen_protocol_items.create({ data });
    }
    async findRegimenProtocolItemById(protocolItemId) {
        return prisma_1.default.chemotherapy_regimen_protocol_items.findUnique({ where: { protocol_item_id: protocolItemId } });
    }
    async deactivateRegimenProtocolItem(tx, protocolItemId) {
        return tx.chemotherapy_regimen_protocol_items.update({
            where: { protocol_item_id: protocolItemId },
            data: { active_status: 0 }
        });
    }
    // -----------------------------------------------------------------
    // Supporting entity lookups (existence checks only - these tables
    // belong to other modules)
    // -----------------------------------------------------------------
    async findMedicineById(medicineId) {
        return prisma_1.default.medicine_master.findUnique({ where: { medicine_id: medicineId } });
    }
    async findDepartmentById(departmentId) {
        return prisma_1.default.department_master.findUnique({ where: { department_id: departmentId } });
    }
    async findEmployeeById(employeeId) {
        return prisma_1.default.employees.findUnique({ where: { employee_id: employeeId } });
    }
    async findBranchById(branchId) {
        return prisma_1.default.branch.findUnique({ where: { branch_id: branchId } });
    }
    async findDiagnosisById(diagnosisId) {
        return prisma_1.default.diagnosis.findUnique({ where: { diagnosis_id: diagnosisId } });
    }
    async findPatientById(patientId) {
        return prisma_1.default.patient_bio_data.findUnique({ where: { patient_id: patientId } });
    }
    async findMostRecentPatientHistory(patientId) {
        return prisma_1.default.patient_history.findFirst({
            where: { patient_id: patientId },
            orderBy: { visit_date: "desc" }
        });
    }
    async findPatientHistoryById(patientHistoryId) {
        return prisma_1.default.patient_history.findUnique({ where: { patient_history_id: patientHistoryId } });
    }
    async createPatientHistory(tx, data) {
        return tx.patient_history.create({ data });
    }
    // -----------------------------------------------------------------
    // chemotherapy_plan
    // -----------------------------------------------------------------
    async generatePlanId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.PLAN);
    }
    async createPlan(tx, data) {
        return tx.chemotherapy_plan.create({ data });
    }
    async updatePlan(tx, planId, data) {
        return tx.chemotherapy_plan.update({
            where: { chemotherapy_plan_id: planId },
            data: { ...data, updated_at: new Date() }
        });
    }
    planInclude = {
        chemotherapy_plan_items: {
            where: { active_status: 1 },
            include: { medicine_master: true }
        },
        chemotherapy_cycle: { where: { active_status: 1 }, orderBy: { cycle_number: "asc" } },
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
    };
    async findPlanById(planId) {
        return prisma_1.default.chemotherapy_plan.findUnique({
            where: { chemotherapy_plan_id: planId },
            include: this.planInclude
        });
    }
    async findPlanForUpdate(tx, planId) {
        return tx.chemotherapy_plan.findUnique({ where: { chemotherapy_plan_id: planId } });
    }
    async listPlans(filters) {
        const page = filters.page && filters.page > 0 ? filters.page : 1;
        const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
        const where = {
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
            prisma_1.default.chemotherapy_plan.findMany({
                where,
                include: this.planInclude,
                orderBy: { created_at: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.chemotherapy_plan.count({ where })
        ]);
        return { rows, total, page, limit };
    }
    // -----------------------------------------------------------------
    // chemotherapy_plan_items
    // -----------------------------------------------------------------
    async generatePlanItemId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.PLAN_ITEM);
    }
    async createPlanItem(tx, data) {
        return tx.chemotherapy_plan_items.create({ data });
    }
    async findPlanItemById(planItemId) {
        return prisma_1.default.chemotherapy_plan_items.findUnique({ where: { chemotherapy_plan_item_id: planItemId } });
    }
    async updatePlanItem(tx, planItemId, data) {
        return tx.chemotherapy_plan_items.update({
            where: { chemotherapy_plan_item_id: planItemId },
            data: { ...data, updated_at: new Date() }
        });
    }
    async deactivatePlanItem(tx, planItemId) {
        return tx.chemotherapy_plan_items.update({
            where: { chemotherapy_plan_item_id: planItemId },
            data: { active_status: 0, updated_at: new Date() }
        });
    }
    // -----------------------------------------------------------------
    // chemotherapy_cycle
    // -----------------------------------------------------------------
    async generateCycleId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.CYCLE);
    }
    async createCycle(tx, data) {
        return tx.chemotherapy_cycle.create({ data });
    }
    cycleInclude = {
        chemotherapy_administration: { where: { active_status: 1 } },
        chemotherapy_vitals: { where: { active_status: 1 } },
        chemotherapy_adverse_event: { where: { active_status: 1 } },
        chemotherapy_lab_review: { where: { active_status: 1 } },
        chemotherapy_followup: { where: { active_status: 1 } }
    };
    async findCycleById(cycleId) {
        return prisma_1.default.chemotherapy_cycle.findUnique({
            where: { chemotherapy_cycle_id: cycleId },
            include: this.cycleInclude
        });
    }
    async findCycleForUpdate(tx, cycleId) {
        return tx.chemotherapy_cycle.findUnique({ where: { chemotherapy_cycle_id: cycleId } });
    }
    async listCyclesForPlan(planId) {
        return prisma_1.default.chemotherapy_cycle.findMany({
            where: { chemotherapy_plan_id: planId, active_status: 1 },
            include: this.cycleInclude,
            orderBy: { cycle_number: "asc" }
        });
    }
    async updateCycle(tx, cycleId, data) {
        return tx.chemotherapy_cycle.update({
            where: { chemotherapy_cycle_id: cycleId },
            data: { ...data, updated_at: new Date() }
        });
    }
    // -----------------------------------------------------------------
    // chemotherapy_administration
    // -----------------------------------------------------------------
    async generateAdministrationId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.ADMINISTRATION);
    }
    async createAdministration(tx, data) {
        return tx.chemotherapy_administration.create({ data });
    }
    async countAdministrationsForCycle(cycleId) {
        return prisma_1.default.chemotherapy_administration.count({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 }
        });
    }
    async countAdministrationsForPlan(planId) {
        return prisma_1.default.chemotherapy_administration.count({
            where: {
                active_status: 1,
                chemotherapy_cycle: { chemotherapy_plan_id: planId }
            }
        });
    }
    async listAdministrationsForCycle(cycleId) {
        return prisma_1.default.chemotherapy_administration.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { administration_date: "asc" }
        });
    }
    // -----------------------------------------------------------------
    // chemotherapy_vitals / chemotherapy_adverse_event /
    // chemotherapy_lab_review / chemotherapy_followup - all append-only,
    // tied 1:many to a cycle.
    // -----------------------------------------------------------------
    async generateVitalsId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.VITALS);
    }
    async createVitals(tx, data) {
        return tx.chemotherapy_vitals.create({ data });
    }
    async listVitalsForCycle(cycleId) {
        return prisma_1.default.chemotherapy_vitals.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { recorded_at: "asc" }
        });
    }
    async generateAdverseEventId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.ADVERSE_EVENT);
    }
    async createAdverseEvent(tx, data) {
        return tx.chemotherapy_adverse_event.create({ data });
    }
    async listAdverseEventsForCycle(cycleId) {
        return prisma_1.default.chemotherapy_adverse_event.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { event_date: "asc" }
        });
    }
    async generateLabReviewId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.LAB_REVIEW);
    }
    async createLabReview(tx, data) {
        return tx.chemotherapy_lab_review.create({ data });
    }
    async listLabReviewsForCycle(cycleId) {
        return prisma_1.default.chemotherapy_lab_review.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { review_date: "asc" }
        });
    }
    async generateFollowupId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.FOLLOWUP);
    }
    async createFollowup(tx, data) {
        return tx.chemotherapy_followup.create({ data });
    }
    async listFollowupsForCycle(cycleId) {
        return prisma_1.default.chemotherapy_followup.findMany({
            where: { chemotherapy_cycle_id: cycleId, active_status: 1 },
            orderBy: { followup_date: "asc" }
        });
    }
}
exports.ChemotherapyRepository = ChemotherapyRepository;
