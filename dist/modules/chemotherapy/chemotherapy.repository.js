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
        chemotherapy_regimen_protocol_days: { where: { active_status: 1 }, orderBy: { day_number: "asc" }, include: { chemotherapy_regimen_protocol_items: { include: { medicine_master: true } } } },
        chemotherapy_regimen_protocol_items: { where: { active_status: 1 }, orderBy: { drug_sequence: "asc" }, include: { medicine_master: true } },
        cancer_types: { select: { cancer_type_id: true, cancer_type: true } },
        cancer_subtypes: { select: { subtype_id: true, subtype_name: true } }
    };
    async listRegimenProtocols(filters) {
        return prisma_1.default.chemotherapy_regimen_protocol.findMany({
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
    async findRegimenProtocolById(protocolId) {
        return prisma_1.default.chemotherapy_regimen_protocol.findUnique({
            where: { protocol_id: protocolId },
            include: this.protocolInclude
        });
    }
    // DILUTION DETAILS that are attached to the protocol but not to any
    // specific item (protocol_item_id IS NULL). These legacy detached rows
    // are not visible via the item-attached chemotherapy_protocol_dilutions
    // relation, so they are surfaced separately for the protocol builder.
    async listProtocolLevelDilutions(protocolId) {
        return prisma_1.default.chemotherapy_protocol_dilutions.findMany({
            where: { protocol_id: protocolId, active_status: 1, protocol_item_id: null },
            orderBy: { created_at: "asc" }
        });
    }
    async listDischargeMedicinesForProtocol(protocolId) {
        return prisma_1.default.chemotherapy_discharge_instructions.findMany({
            where: { protocol_id: protocolId, active_status: 1 },
            include: { medicine_master: true },
            orderBy: { drug_sequence: "asc" }
        });
    }
<<<<<<< HEAD
    async listDischargeMedicinesByProtocol(protocolId) {
        return prisma_1.default.chemotherapy_discharge_instructions.findMany({
            where: { protocol_id: protocolId, active_status: 1 },
            orderBy: { drug_sequence: "asc" },
            include: { medicine_master: true }
=======
    async generateDischargeInstructionId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.DISCHARGE_INSTRUCTION);
    }
    async createDischargeInstruction(tx, data) {
        return tx.chemotherapy_discharge_instructions.create({ data });
    }
    async updateDischargeInstruction(tx, dischargeInstructionId, data) {
        return tx.chemotherapy_discharge_instructions.update({
            where: { discharge_instruction_id: dischargeInstructionId },
            data: { ...data, updated_at: new Date() }
        });
    }
    async deactivateDischargeInstruction(tx, dischargeInstructionId) {
        return tx.chemotherapy_discharge_instructions.update({
            where: { discharge_instruction_id: dischargeInstructionId },
            data: { active_status: 0, updated_at: new Date() }
        });
    }
    async findDischargeInstructionById(dischargeInstructionId) {
        return prisma_1.default.chemotherapy_discharge_instructions.findUnique({
            where: { discharge_instruction_id: dischargeInstructionId }
>>>>>>> ff69177530de672db4f4a9ccb0cc533a8b64292e
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
    async updateRegimenProtocolItem(tx, protocolItemId, data) {
        return tx.chemotherapy_regimen_protocol_items.update({
            where: { protocol_item_id: protocolItemId },
            data
        });
    }
    async findRegimenProtocolItemById(protocolItemId) {
        return prisma_1.default.chemotherapy_regimen_protocol_items.findUnique({
            where: { protocol_item_id: protocolItemId },
            include: { chemotherapy_protocol_dilutions: { where: { active_status: 1 } } }
        });
    }
    async deactivateRegimenProtocolItem(tx, protocolItemId) {
        return tx.chemotherapy_regimen_protocol_items.update({
            where: { protocol_item_id: protocolItemId },
            data: { active_status: 0 }
        });
    }
    // -----------------------------------------------------------------
    // Organization-specific personalized protocols (protocol hierarchy:
    // protocol -> days -> items -> dilutions)
    // -----------------------------------------------------------------
    personalizedProtocolInclude = {
        chemotherapy_regimen_protocol_days: { where: { active_status: 1 }, orderBy: { day_number: "asc" } },
        chemotherapy_regimen_protocol_items: {
            where: { active_status: 1 },
            orderBy: { drug_sequence: "asc" },
            include: {
                medicine_master: true,
                chemotherapy_protocol_dilutions: { where: { active_status: 1 } }
            }
        },
        cancer_types: { select: { cancer_type_id: true, cancer_type: true } },
        cancer_subtypes: { select: { subtype_id: true, subtype_name: true } }
    };
    async findRegimenProtocolByIdFull(protocolId) {
        return prisma_1.default.chemotherapy_regimen_protocol.findUnique({
            where: { protocol_id: protocolId },
            include: this.personalizedProtocolInclude
        });
    }
    async findPersonalizedProtocolById(protocolId, organizationId) {
        return prisma_1.default.chemotherapy_regimen_protocol.findFirst({
            where: { protocol_id: protocolId, organization_id: organizationId, protocol_type: "PERSONALIZED" },
            include: this.personalizedProtocolInclude
        });
    }
    async listPersonalizedProtocols(organizationId) {
        return prisma_1.default.chemotherapy_regimen_protocol.findMany({
            where: { organization_id: organizationId, protocol_type: "PERSONALIZED" },
            include: this.personalizedProtocolInclude,
            orderBy: { created_at: "desc" }
        });
    }
    async findHospitalById(hospitalId) {
        return prisma_1.default.hospital.findUnique({ where: { hospital_id: hospitalId } });
    }
    async countPlansUsingProtocol(protocolId) {
        return prisma_1.default.chemotherapy_plan.count({
            where: { source_protocol_id: protocolId, deleted_flag: false }
        });
    }
    async generateRegimenProtocolDayId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.REGIMEN_PROTOCOL_DAY);
    }
    async generateRegimenProtocolDilutionId(tx) {
        return (0, idGenerator_1.generateId)(tx, chemotherapy_constants_1.ID_ENTITY.REGIMEN_PROTOCOL_DILUTION);
    }
    async createRegimenProtocolDay(tx, data) {
        return tx.chemotherapy_regimen_protocol_days.create({ data });
    }
    async updateRegimenProtocolDay(tx, protocolDayId, data) {
        return tx.chemotherapy_regimen_protocol_days.updateMany({
            where: { protocol_day_id: protocolDayId },
            data: { ...data, updated_at: new Date() }
        });
    }
    async deactivateRegimenProtocolDay(tx, protocolDayId) {
        return tx.chemotherapy_regimen_protocol_days.updateMany({
            where: { protocol_day_id: protocolDayId },
            data: { active_status: 0, updated_at: new Date() }
        });
    }
    async findRegimenProtocolDayById(protocolDayId) {
        return prisma_1.default.chemotherapy_regimen_protocol_days.findFirst({ where: { protocol_day_id: protocolDayId } });
    }
    async findRegimenProtocolDaysByProtocolId(protocolId) {
        return prisma_1.default.chemotherapy_regimen_protocol_days.findMany({ where: { protocol_id: protocolId } });
    }
    async createRegimenProtocolDilution(tx, data) {
        return tx.chemotherapy_protocol_dilutions.create({ data });
    }
    async updateRegimenProtocolDilution(tx, protocolDilutionId, data) {
        return tx.chemotherapy_protocol_dilutions.update({
            where: { protocol_dilution_id: protocolDilutionId },
            data: { ...data, updated_at: new Date() }
        });
    }
    async deactivateRegimenProtocolDilution(tx, protocolDilutionId) {
        return tx.chemotherapy_protocol_dilutions.update({
            where: { protocol_dilution_id: protocolDilutionId },
            data: { active_status: 0, updated_at: new Date() }
        });
    }
    async findRegimenProtocolDilutionById(protocolDilutionId) {
        return prisma_1.default.chemotherapy_protocol_dilutions.findUnique({ where: { protocol_dilution_id: protocolDilutionId } });
    }
    // -----------------------------------------------------------------
    // Supporting entity lookups (existence checks only - these tables
    // belong to other modules)
    // -----------------------------------------------------------------
    async findMedicineById(medicineId) {
        return prisma_1.default.medicine_master.findUnique({ where: { medicine_id: medicineId } });
    }
    async findActiveMedicineById(medicineId) {
        return prisma_1.default.medicine_master.findFirst({ where: { medicine_id: medicineId, is_active: true } });
    }
    async listAllActiveMedicines() {
        return prisma_1.default.medicine_master.findMany({
            where: { is_active: true },
            select: {
                medicine_id: true,
                medicine_name: true,
                generic_name: true,
                strength: true,
                dosage_form: true,
                unit: true,
                route: true
            },
            orderBy: { medicine_name: "asc" }
        });
    }
    // Distinct active medicines that are referenced by the medicine_id column
    // of the chemotherapy_protocol_dilutions table.
    async listDilutionMedicines() {
        const dilutions = await prisma_1.default.chemotherapy_protocol_dilutions.findMany({
            where: { active_status: 1, medicine_id: { not: null } },
            select: {
                medicine_id: true,
                medicine_master: {
                    select: {
                        medicine_id: true,
                        medicine_name: true,
                        generic_name: true,
                        strength: true,
                        dosage_form: true,
                        unit: true,
                        route: true
                    }
                }
            },
            orderBy: { medicine_master: { medicine_name: "asc" } }
        });
        const seen = new Map();
        for (const d of dilutions) {
            if (d.medicine_master && !seen.has(d.medicine_id))
                seen.set(d.medicine_id, d.medicine_master);
        }
        return [...seen.values()];
    }
    // Distinct active medicines already used in active protocols matching the
    // given cancer type/subtype and drug role. A protocol with null subtype
    // applies to the whole cancer type, so both subtype-specific and
    // type-wide protocols are included.
    async getMedicinesByCancerTypeAndSubtype(cancerTypeId, subtypeId, drugRole) {
        const items = await prisma_1.default.chemotherapy_regimen_protocol_items.findMany({
            where: {
                drug_role: drugRole,
                active_status: 1,
                chemotherapy_regimen_protocol: {
                    cancer_type_id: cancerTypeId,
                    active_status: 1,
                    ...(subtypeId
                        ? { OR: [{ subtype_id: subtypeId }, { subtype_id: null }] }
                        : {})
                },
                medicine_master: { is_active: true }
            },
            include: {
                medicine_master: {
                    select: {
                        medicine_id: true,
                        medicine_name: true,
                        generic_name: true,
                        strength: true,
                        dosage_form: true,
                        unit: true,
                        route: true
                    }
                }
            },
            orderBy: { medicine_master: { medicine_name: "asc" } }
        });
        const seen = new Map();
        for (const item of items) {
            if (!seen.has(item.medicine_id))
                seen.set(item.medicine_id, item.medicine_master);
        }
        return [...seen.values()];
    }
    async listMedicinesByDrugRole(drugRole) {
        const items = await prisma_1.default.chemotherapy_regimen_protocol_items.findMany({
            where: {
                drug_role: drugRole,
                active_status: 1,
                chemotherapy_regimen_protocol: {
                    active_status: 1
                },
                medicine_master: { is_active: true }
            },
            include: {
                medicine_master: {
                    select: {
                        medicine_id: true,
                        medicine_name: true,
                        generic_name: true,
                        strength: true,
                        dosage_form: true,
                        unit: true,
                        route: true
                    }
                }
            },
            orderBy: { medicine_master: { medicine_name: "asc" } }
        });
        const seen = new Map();
        for (const item of items) {
            if (!seen.has(item.medicine_id))
                seen.set(item.medicine_id, item.medicine_master);
        }
        return [...seen.values()];
    }
    // Distinct non-null values (ordered A-Z) used across regimen-protocol
    // items and dilutions, to feed the FORM / DOSE UNIT / VOLUME UNIT /
    // dosage-unit dropdowns in the protocol-builder UI.
    async getProtocolFieldOptions() {
        const [dosageUnits, dilutionForms, dilutionDoseUnits, dilutionVolumeUnits, diluents] = await Promise.all([
            prisma_1.default.chemotherapy_regimen_protocol_items.findMany({
                where: { dosage_unit: { not: null } },
                select: { dosage_unit: true },
                distinct: ["dosage_unit"],
                orderBy: { dosage_unit: "asc" }
            }),
            prisma_1.default.chemotherapy_protocol_dilutions.findMany({
                where: { form: { not: null } },
                select: { form: true },
                distinct: ["form"],
                orderBy: { form: "asc" }
            }),
            prisma_1.default.chemotherapy_protocol_dilutions.findMany({
                where: { dose_unit: { not: null } },
                select: { dose_unit: true },
                distinct: ["dose_unit"],
                orderBy: { dose_unit: "asc" }
            }),
            prisma_1.default.chemotherapy_protocol_dilutions.findMany({
                where: { dilution_volume_unit: { not: null } },
                select: { dilution_volume_unit: true },
                distinct: ["dilution_volume_unit"],
                orderBy: { dilution_volume_unit: "asc" }
            }),
            prisma_1.default.chemotherapy_protocol_dilutions.findMany({
                where: { diluent: { not: null } },
                select: { diluent: true },
                distinct: ["diluent"],
                orderBy: { diluent: "asc" }
            })
        ]);
        return {
            dosage_units: dosageUnits.map((d) => d.dosage_unit).filter((v) => !!v),
            dilution_forms: dilutionForms.map((d) => d.form).filter((v) => !!v),
            dilution_dose_units: dilutionDoseUnits.map((d) => d.dose_unit).filter((v) => !!v),
            dilution_volume_units: dilutionVolumeUnits.map((d) => d.dilution_volume_unit).filter((v) => !!v),
            diluents: diluents.map((d) => d.diluent).filter((v) => !!v)
        };
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
    async findActiveBranchMappingsForUser(userId) {
        return prisma_1.default.user_branch_mapping.findMany({
            where: { user_id: userId, status: 1 },
            select: { branch_id: true }
        });
    }
    // Latest active plan for a patient, newest first. When branchIds is
    // null (top-level admin) every branch is visible.
    async findLatestPlanForPatient(patientId, branchIds) {
        return prisma_1.default.chemotherapy_plan.findFirst({
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
    async listSupportiveMedicines() {
        return prisma_1.default.medicine_master.findMany({
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
exports.ChemotherapyRepository = ChemotherapyRepository;
