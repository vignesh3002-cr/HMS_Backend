"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChemotherapyService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const chemotherapy_repository_1 = require("./chemotherapy.repository");
const oncology_repository_1 = require("../oncology/oncology.repository");
const chemotherapy_constants_1 = require("./chemotherapy.constants");
const audit_service_1 = require("../audit/audit.service");
const audit_types_1 = require("../audit/audit.types");
function isPlanStatus(value) {
    return Object.values(chemotherapy_constants_1.PLAN_STATUS).includes(value);
}
function isCycleStatus(value) {
    return Object.values(chemotherapy_constants_1.CYCLE_STATUS).includes(value);
}
function appendNote(existing, note) {
    if (!note) {
        return existing ?? null;
    }
    return existing ? `${existing}\n${note}` : note;
}
class ChemotherapyService {
    repository = new chemotherapy_repository_1.ChemotherapyRepository();
    oncologyRepository = new oncology_repository_1.OncologyRepository();
    // ---------------------------------------------------------------
    // Plan preview - lets a doctor see the computed suggested_therapy
    // (which may legitimately be null outside Breast/Lung) before they
    // decide whether to confirm it and create the plan.
    // ---------------------------------------------------------------
    async previewPlan(stagingDetailId) {
        const staging = await this.repository_findStagingDetailOrThrow(stagingDetailId);
        // Surfaced alongside the advisory suggested_therapy text so the
        // doctor can pick a matching protocol to pre-fill the create-plan
        // form with - matching_protocols is just a menu, nothing here is
        // applied automatically.
        const matchingProtocols = await this.repository.listRegimenProtocols({
            cancer_type_id: staging.cancer_type_id,
            subtype_id: staging.cancer_subtype_id
        });
        return {
            staging_detail_id: staging.staging_detail_id,
            patient_id: staging.patient_id,
            cancer_type: staging.cancer_types.cancer_type,
            cancer_subtype: staging.cancer_subtypes.subtype_name,
            clinical_stage: staging.clinical_stage,
            suggested_therapy: staging.derived_fields?.suggested_therapy ?? null,
            breast_mol_subtype: staging.derived_fields?.breast_mol_subtype ?? null,
            germline_referral_flag: staging.derived_fields?.germline_referral_flag ?? false,
            matching_protocols: matchingProtocols
        };
    }
    // ---------------------------------------------------------------
    // Regimen protocol templates (reference data - browsing does not
    // require a staging detail; previewPlan above is the shortcut for the
    // "already picked a diagnosis" path).
    // ---------------------------------------------------------------
    async listRegimenProtocols(filters) {
        return this.repository.listRegimenProtocols(filters);
    }
    async getRegimenProtocol(protocolId) {
        const protocol = await this.repository.findRegimenProtocolById(protocolId);
        if (!protocol) {
            throw new Error("Regimen protocol not found");
        }
        return protocol;
    }
    async createRegimenProtocol(dto, actingUserId) {
        const cancerType = await this.repository.findCancerTypeById(dto.cancer_type_id);
        if (!cancerType) {
            throw new Error("Cancer type not found");
        }
        if (dto.subtype_id) {
            const subtype = await this.repository.findCancerSubtypeById(dto.subtype_id);
            if (!subtype) {
                throw new Error("Cancer subtype not found");
            }
            if (subtype.cancer_type_id !== dto.cancer_type_id) {
                throw new Error("Selected subtype does not belong to the selected cancer type");
            }
        }
        const existing = await this.repository.findRegimenProtocolByCode(dto.cancer_type_id, dto.subtype_id ?? null, dto.regimen_code);
        if (existing) {
            throw new Error(`A protocol with code ${dto.regimen_code} already exists for this cancer type/subtype`);
        }
        if (!dto.items || dto.items.length === 0) {
            throw new Error("At least one protocol item (drug) is required");
        }
        for (const item of dto.items) {
            const medicine = await this.repository.findMedicineById(item.medicine_id);
            if (!medicine) {
                throw new Error(`Medicine not found: ${item.medicine_id}`);
            }
        }
        const protocolId = await prisma_1.default.$transaction(async (tx) => {
            const newProtocolId = await this.repository.generateRegimenProtocolId(tx);
            await this.repository.createRegimenProtocol(tx, {
                protocol_id: newProtocolId,
                regimen_code: dto.regimen_code,
                regimen_name: dto.regimen_name,
                protocol_version: dto.protocol_version ?? null,
                cancer_type_id: dto.cancer_type_id,
                subtype_id: dto.subtype_id ?? null,
                treatment_intent: dto.treatment_intent ?? null,
                standard_cycles: dto.standard_cycles ?? null,
                cycle_interval_days: dto.cycle_interval_days ?? null,
                guideline_source: dto.guideline_source ?? null,
                notes: dto.notes ?? null
            });
            for (const item of dto.items) {
                const itemId = await this.repository.generateRegimenProtocolItemId(tx);
                await this.repository.createRegimenProtocolItem(tx, {
                    protocol_item_id: itemId,
                    protocol_id: newProtocolId,
                    medicine_id: item.medicine_id,
                    drug_role: item.drug_role ?? "PRIMARY",
                    drug_sequence: item.drug_sequence,
                    drug_type: item.drug_type ?? null,
                    dosage: item.dosage ?? null,
                    dosage_unit: item.dosage_unit ?? null,
                    dose_calculation_method: item.dose_calculation_method ?? null,
                    administration_route: item.administration_route ?? null,
                    infusion_type: item.infusion_type ?? null,
                    infusion_duration_minutes: item.infusion_duration_minutes ?? null,
                    administration_day: item.administration_day ?? null,
                    cycle_day: item.cycle_day ?? null,
                    frequency: item.frequency ?? null,
                    timing_relative_to_primary: item.timing_relative_to_primary ?? null,
                    remarks: item.remarks ?? null
                });
            }
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_regimen_protocol",
                entity_id: newProtocolId,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: (0, audit_service_1.summarizeCreate)({ regimen_code: dto.regimen_code, cancer_type_id: dto.cancer_type_id, subtype_id: dto.subtype_id ?? null, item_count: dto.items.length })
            });
            return newProtocolId;
        }, { timeout: 20000 });
        return this.getRegimenProtocol(protocolId);
    }
    async updateRegimenProtocol(protocolId, dto, actingUserId) {
        const existing = await this.repository.findRegimenProtocolById(protocolId);
        if (!existing) {
            throw new Error("Regimen protocol not found");
        }
        const protocolChanges = {
            ...(dto.regimen_name !== undefined ? { regimen_name: dto.regimen_name } : {}),
            ...(dto.protocol_version !== undefined ? { protocol_version: dto.protocol_version } : {}),
            ...(dto.treatment_intent !== undefined ? { treatment_intent: dto.treatment_intent } : {}),
            ...(dto.standard_cycles !== undefined ? { standard_cycles: dto.standard_cycles } : {}),
            ...(dto.cycle_interval_days !== undefined ? { cycle_interval_days: dto.cycle_interval_days } : {}),
            ...(dto.guideline_source !== undefined ? { guideline_source: dto.guideline_source } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {})
        };
        await prisma_1.default.$transaction(async (tx) => {
            await this.repository.updateRegimenProtocol(tx, protocolId, protocolChanges);
            if (Object.keys(protocolChanges).length > 0) {
                await (0, audit_service_1.logAudit)(tx, {
                    entity_type: "chemotherapy_regimen_protocol",
                    entity_id: protocolId,
                    action: audit_types_1.AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    change_summary: (0, audit_service_1.diffFields)(existing, protocolChanges)
                });
            }
        });
        return this.getRegimenProtocol(protocolId);
    }
    async addRegimenProtocolItem(protocolId, item, actingUserId) {
        const existing = await this.repository.findRegimenProtocolById(protocolId);
        if (!existing) {
            throw new Error("Regimen protocol not found");
        }
        const medicine = await this.repository.findMedicineById(item.medicine_id);
        if (!medicine) {
            throw new Error("Medicine not found");
        }
        await prisma_1.default.$transaction(async (tx) => {
            const itemId = await this.repository.generateRegimenProtocolItemId(tx);
            await this.repository.createRegimenProtocolItem(tx, {
                protocol_item_id: itemId,
                protocol_id: protocolId,
                medicine_id: item.medicine_id,
                drug_role: item.drug_role ?? "PRIMARY",
                drug_sequence: item.drug_sequence,
                drug_type: item.drug_type ?? null,
                dosage: item.dosage ?? null,
                dosage_unit: item.dosage_unit ?? null,
                dose_calculation_method: item.dose_calculation_method ?? null,
                administration_route: item.administration_route ?? null,
                infusion_type: item.infusion_type ?? null,
                infusion_duration_minutes: item.infusion_duration_minutes ?? null,
                administration_day: item.administration_day ?? null,
                cycle_day: item.cycle_day ?? null,
                frequency: item.frequency ?? null,
                timing_relative_to_primary: item.timing_relative_to_primary ?? null,
                remarks: item.remarks ?? null
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_regimen_protocol_items",
                entity_id: itemId,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: (0, audit_service_1.summarizeCreate)({ protocol_id: protocolId, medicine_id: item.medicine_id, drug_role: item.drug_role ?? "PRIMARY" })
            });
        });
        return this.getRegimenProtocol(protocolId);
    }
    async removeRegimenProtocolItem(protocolId, protocolItemId, actingUserId) {
        const existing = await this.repository.findRegimenProtocolById(protocolId);
        if (!existing) {
            throw new Error("Regimen protocol not found");
        }
        const item = await this.repository.findRegimenProtocolItemById(protocolItemId);
        if (!item || item.protocol_id !== protocolId) {
            throw new Error("Protocol item not found on this protocol");
        }
        await prisma_1.default.$transaction(async (tx) => {
            await this.repository.deactivateRegimenProtocolItem(tx, protocolItemId);
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_regimen_protocol_items",
                entity_id: protocolItemId,
                action: audit_types_1.AUDIT_ACTION.DEACTIVATE,
                performed_by: actingUserId,
                change_summary: (0, audit_service_1.summarizeCreate)({ protocol_id: protocolId, medicine_id: item.medicine_id })
            });
        });
        return this.getRegimenProtocol(protocolId);
    }
    async repository_findStagingDetailOrThrow(stagingDetailId) {
        const staging = await this.oncologyRepository.findStagingDetailById(stagingDetailId);
        if (!staging) {
            throw new Error("Staging detail not found");
        }
        return staging;
    }
    // ---------------------------------------------------------------
    // Plan CRUD
    // ---------------------------------------------------------------
    async createPlan(dto, actingUserId) {
        if (dto.confirm_suggested_therapy !== true) {
            throw new Error("Explicit confirmation of the suggested therapy (or clinical rationale, if none was computed) is required before creating a chemotherapy plan");
        }
        const patient = await this.repository.findPatientById(dto.patient_id);
        if (!patient) {
            throw new Error("Patient not found");
        }
        const staging = await this.repository_findStagingDetailOrThrow(dto.staging_detail_id);
        if (staging.patient_id !== dto.patient_id) {
            throw new Error("The staging detail does not belong to this patient");
        }
        const diagnosis = await this.repository.findDiagnosisById(dto.diagnosis_id);
        if (!diagnosis) {
            throw new Error("Diagnosis not found");
        }
        const employee = await this.repository.findEmployeeById(dto.employee_id);
        if (!employee) {
            throw new Error("Doctor (employee) not found");
        }
        const department = await this.repository.findDepartmentById(dto.department_id);
        if (!department) {
            throw new Error("Department not found");
        }
        const branch = await this.repository.findBranchById(dto.branch_id);
        if (!branch) {
            throw new Error("Branch not found");
        }
        // If a protocol was picked, resolve its defaults - anything also
        // present in the request body (planned_cycles, cycle_interval_days,
        // plan_items, regimen_name/code) overrides the protocol's value.
        // This is a one-time copy: nothing here reads back from or writes to
        // chemotherapy_regimen_protocol after this point.
        let protocol = null;
        if (dto.protocol_id) {
            protocol = await this.repository.findRegimenProtocolById(dto.protocol_id);
            if (!protocol) {
                throw new Error("Regimen protocol not found");
            }
            if (protocol.cancer_type_id !== staging.cancer_type_id) {
                throw new Error("Selected protocol does not match this patient's diagnosed cancer type");
            }
            if (protocol.subtype_id && protocol.subtype_id !== staging.cancer_subtype_id) {
                throw new Error("Selected protocol does not match this patient's diagnosed cancer subtype");
            }
        }
        const resolvedRegimenName = dto.regimen_name ?? protocol?.regimen_name;
        const resolvedRegimenCode = dto.regimen_code ?? protocol?.regimen_code ?? null;
        const resolvedPlannedCycles = dto.planned_cycles ?? protocol?.standard_cycles ?? null;
        const resolvedCycleIntervalDays = dto.cycle_interval_days ?? protocol?.cycle_interval_days ?? null;
        const resolvedPlanItems = (dto.plan_items && dto.plan_items.length > 0)
            ? dto.plan_items
            : (protocol?.chemotherapy_regimen_protocol_items ?? []).map((item) => ({
                medicine_id: item.medicine_id,
                drug_role: item.drug_role,
                drug_sequence: item.drug_sequence,
                drug_type: item.drug_type,
                dosage: item.dosage != null ? Number(item.dosage) : null,
                dosage_unit: item.dosage_unit,
                administration_route: item.administration_route,
                infusion_type: item.infusion_type,
                infusion_duration_minutes: item.infusion_duration_minutes,
                administration_day: item.administration_day,
                cycle_day: item.cycle_day,
                frequency: item.frequency,
                remarks: item.remarks
            }));
        if (!resolvedRegimenName) {
            throw new Error("regimen_name is required (or select a protocol_id to default it)");
        }
        if (!resolvedPlannedCycles || resolvedPlannedCycles < 1) {
            throw new Error("planned_cycles must be at least 1 (or select a protocol with a standard cycle count)");
        }
        if (resolvedPlanItems.length === 0) {
            throw new Error("At least one plan item (drug) is required (or select a protocol_id)");
        }
        for (const item of resolvedPlanItems) {
            const medicine = await this.repository.findMedicineById(item.medicine_id);
            if (!medicine) {
                throw new Error(`Medicine not found: ${item.medicine_id}`);
            }
        }
        // Resolve patient_history_id: use what was passed (validated to
        // belong to this patient), else the patient's most recent record,
        // else auto-provision a minimal one - the column is NOT NULL but
        // almost no patient has one yet (no intake module writes it).
        let patientHistoryId = dto.patient_history_id ?? null;
        if (patientHistoryId) {
            const history = await this.repository.findPatientHistoryById(patientHistoryId);
            if (!history) {
                throw new Error("patient_history_id not found");
            }
            if (history.patient_id !== dto.patient_id) {
                throw new Error("The supplied patient_history_id does not belong to this patient");
            }
        }
        else {
            const existingHistory = await this.repository.findMostRecentPatientHistory(dto.patient_id);
            patientHistoryId = existingHistory?.patient_history_id ?? null;
        }
        const planId = await prisma_1.default.$transaction(async (tx) => {
            let finalPatientHistoryId;
            if (patientHistoryId) {
                finalPatientHistoryId = patientHistoryId;
            }
            else {
                finalPatientHistoryId = await (0, idGenerator_1.generateId)(tx, "PATIENT_HISTORY");
                await this.repository.createPatientHistory(tx, {
                    patient_history_id: finalPatientHistoryId,
                    patient_id: dto.patient_id,
                    visit_type: "Oncology",
                    visit_date: new Date(),
                    branch_id: dto.branch_id,
                    department_id: dto.department_id,
                    employee_id: dto.employee_id,
                    diagnosis_id: dto.diagnosis_id
                });
            }
            const newPlanId = await this.repository.generatePlanId(tx);
            await this.repository.createPlan(tx, {
                chemotherapy_plan_id: newPlanId,
                patient_history_id: finalPatientHistoryId,
                patient_id: dto.patient_id,
                encounter_no: dto.encounter_no ?? null,
                appointment_id: dto.appointment_id ?? null,
                diagnosis_id: dto.diagnosis_id,
                employee_id: dto.employee_id,
                department_id: dto.department_id,
                branch_id: dto.branch_id,
                user_id: actingUserId,
                source_protocol_id: protocol?.protocol_id ?? null,
                regimen_name: resolvedRegimenName,
                regimen_code: resolvedRegimenCode,
                protocol_name: dto.protocol_name ?? protocol?.regimen_name ?? null,
                protocol_version: dto.protocol_version ?? protocol?.protocol_version ?? null,
                treatment_goal: dto.treatment_goal ?? null,
                treatment_intent: dto.treatment_intent ?? protocol?.treatment_intent ?? null,
                cancer_stage: staging.clinical_stage ?? null,
                cancer_type: staging.cancer_types.cancer_type,
                cancer_subtype: staging.cancer_subtypes.subtype_name,
                cancer_type_id: staging.cancer_type_id,
                subtype_id: staging.cancer_subtype_id,
                staging_detail_id: staging.staging_detail_id,
                ecog_status: dto.ecog_status ?? null,
                karnofsky_score: dto.karnofsky_score ?? null,
                planned_cycles: resolvedPlannedCycles,
                completed_cycles: 0,
                cycle_interval_days: resolvedCycleIntervalDays,
                treatment_start_date: new Date(dto.treatment_start_date),
                expected_end_date: dto.expected_end_date ? new Date(dto.expected_end_date) : null,
                treatment_status: chemotherapy_constants_1.PLAN_STATUS.PLANNED,
                consent_taken: dto.consent_taken ?? false,
                consent_date: dto.consent_date ? new Date(dto.consent_date) : null,
                insurance_type: dto.insurance_type ?? null,
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });
            for (const item of resolvedPlanItems) {
                const itemId = await this.repository.generatePlanItemId(tx);
                await this.repository.createPlanItem(tx, {
                    chemotherapy_plan_item_id: itemId,
                    chemotherapy_plan_id: newPlanId,
                    medicine_id: item.medicine_id,
                    drug_role: item.drug_role ?? "PRIMARY",
                    drug_sequence: item.drug_sequence,
                    drug_type: item.drug_type ?? null,
                    dosage: item.dosage ?? null,
                    dosage_unit: item.dosage_unit ?? null,
                    dose_calculation_method: item.dose_calculation_method ?? null,
                    calculated_dose: item.calculated_dose ?? null,
                    administration_route: item.administration_route ?? null,
                    formulation: item.formulation ?? null,
                    infusion_type: item.infusion_type ?? null,
                    infusion_duration_minutes: item.infusion_duration_minutes ?? null,
                    infusion_rate: item.infusion_rate ?? null,
                    dilution_solution: item.dilution_solution ?? null,
                    dilution_volume: item.dilution_volume ?? null,
                    administration_day: item.administration_day ?? null,
                    cycle_day: item.cycle_day ?? null,
                    frequency: item.frequency ?? null,
                    maximum_dose: item.maximum_dose ?? null,
                    minimum_dose: item.minimum_dose ?? null,
                    dose_required: item.dose_required ?? true,
                    remarks: item.remarks ?? null,
                    created_by: actingUserId
                });
            }
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_plan",
                entity_id: newPlanId,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: dto.patient_id,
                branch_id: dto.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({
                    regimen_name: resolvedRegimenName,
                    planned_cycles: resolvedPlannedCycles,
                    source_protocol_id: protocol?.protocol_id ?? null,
                    staging_detail_id: staging.staging_detail_id,
                    item_count: resolvedPlanItems.length
                })
            });
            return newPlanId;
        }, { timeout: 20000 });
        return this.getPlan(planId);
    }
    async getPlan(planId) {
        const plan = await this.repository.findPlanById(planId);
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        return plan;
    }
    async listPlans(filters) {
        return this.repository.listPlans(filters);
    }
    async updatePlan(planId, dto, actingUserId) {
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, planId);
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        if (chemotherapy_constants_1.PLAN_TERMINAL_STATUSES.includes(plan.treatment_status)) {
            throw new Error(`Cannot update a plan that is already ${plan.treatment_status}`);
        }
        const planChanges = {
            ...(dto.regimen_name !== undefined ? { regimen_name: dto.regimen_name } : {}),
            ...(dto.regimen_code !== undefined ? { regimen_code: dto.regimen_code } : {}),
            ...(dto.protocol_name !== undefined ? { protocol_name: dto.protocol_name } : {}),
            ...(dto.protocol_version !== undefined ? { protocol_version: dto.protocol_version } : {}),
            ...(dto.treatment_goal !== undefined ? { treatment_goal: dto.treatment_goal } : {}),
            ...(dto.treatment_intent !== undefined ? { treatment_intent: dto.treatment_intent } : {}),
            ...(dto.ecog_status !== undefined ? { ecog_status: dto.ecog_status } : {}),
            ...(dto.karnofsky_score !== undefined ? { karnofsky_score: dto.karnofsky_score } : {}),
            ...(dto.planned_cycles !== undefined ? { planned_cycles: dto.planned_cycles } : {}),
            ...(dto.cycle_interval_days !== undefined ? { cycle_interval_days: dto.cycle_interval_days } : {}),
            ...(dto.expected_end_date !== undefined ? { expected_end_date: dto.expected_end_date ? new Date(dto.expected_end_date) : null } : {}),
            ...(dto.consent_taken !== undefined ? { consent_taken: dto.consent_taken } : {}),
            ...(dto.consent_date !== undefined ? { consent_date: dto.consent_date ? new Date(dto.consent_date) : null } : {}),
            ...(dto.insurance_type !== undefined ? { insurance_type: dto.insurance_type } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {})
        };
        await prisma_1.default.$transaction(async (tx) => {
            await this.repository.updatePlan(tx, planId, planChanges);
            if (Object.keys(planChanges).length > 0) {
                await (0, audit_service_1.logAudit)(tx, {
                    entity_type: "chemotherapy_plan",
                    entity_id: planId,
                    action: audit_types_1.AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: plan.patient_id,
                    branch_id: plan.branch_id,
                    change_summary: (0, audit_service_1.diffFields)(plan, planChanges)
                });
            }
        });
        return this.getPlan(planId);
    }
    async changePlanStatus(planId, dto, actingUserId) {
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, planId);
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        if (!isPlanStatus(dto.status)) {
            throw new Error(`status must be one of: ${Object.values(chemotherapy_constants_1.PLAN_STATUS).join(", ")}`);
        }
        const current = plan.treatment_status;
        const allowed = chemotherapy_constants_1.PLAN_STATUS_TRANSITIONS[current] ?? [];
        if (!allowed.includes(dto.status)) {
            throw new Error(`Cannot transition plan from ${current} to ${dto.status}`);
        }
        if ((dto.status === chemotherapy_constants_1.PLAN_STATUS.CANCELLED || dto.status === chemotherapy_constants_1.PLAN_STATUS.DISCONTINUED) && !dto.reason?.trim()) {
            throw new Error(`A reason is required to mark a plan as ${dto.status}`);
        }
        await prisma_1.default.$transaction(async (tx) => {
            await this.repository.updatePlan(tx, planId, {
                treatment_status: dto.status,
                remarks: appendNote(plan.remarks, dto.reason ? `[${dto.status}] ${dto.reason}` : null)
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_plan",
                entity_id: planId,
                action: audit_types_1.AUDIT_ACTION.STATUS_CHANGE,
                performed_by: actingUserId,
                patient_id: plan.patient_id,
                branch_id: plan.branch_id,
                change_summary: (0, audit_service_1.summarizeStatusChange)(current, dto.status, dto.reason)
            });
        });
        return this.getPlan(planId);
    }
    // ---------------------------------------------------------------
    // Plan items
    // ---------------------------------------------------------------
    async addPlanItem(planId, dto, actingUserId) {
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, planId);
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        if (chemotherapy_constants_1.PLAN_TERMINAL_STATUSES.includes(plan.treatment_status)) {
            throw new Error(`Cannot add a drug to a plan that is already ${plan.treatment_status}`);
        }
        const medicine = await this.repository.findMedicineById(dto.medicine_id);
        if (!medicine) {
            throw new Error("Medicine not found");
        }
        await prisma_1.default.$transaction(async (tx) => {
            const itemId = await this.repository.generatePlanItemId(tx);
            await this.repository.createPlanItem(tx, {
                chemotherapy_plan_item_id: itemId,
                chemotherapy_plan_id: planId,
                medicine_id: dto.medicine_id,
                drug_role: dto.drug_role ?? "PRIMARY",
                drug_sequence: dto.drug_sequence,
                drug_type: dto.drug_type ?? null,
                dosage: dto.dosage ?? null,
                dosage_unit: dto.dosage_unit ?? null,
                dose_calculation_method: dto.dose_calculation_method ?? null,
                calculated_dose: dto.calculated_dose ?? null,
                administration_route: dto.administration_route ?? null,
                formulation: dto.formulation ?? null,
                infusion_type: dto.infusion_type ?? null,
                infusion_duration_minutes: dto.infusion_duration_minutes ?? null,
                infusion_rate: dto.infusion_rate ?? null,
                dilution_solution: dto.dilution_solution ?? null,
                dilution_volume: dto.dilution_volume ?? null,
                administration_day: dto.administration_day ?? null,
                cycle_day: dto.cycle_day ?? null,
                frequency: dto.frequency ?? null,
                maximum_dose: dto.maximum_dose ?? null,
                minimum_dose: dto.minimum_dose ?? null,
                dose_required: dto.dose_required ?? true,
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_plan_items",
                entity_id: itemId,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan.patient_id,
                branch_id: plan.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({ chemotherapy_plan_id: planId, medicine_id: dto.medicine_id, drug_role: dto.drug_role ?? "PRIMARY" })
            });
        });
        return this.getPlan(planId);
    }
    async updatePlanItem(planId, planItemId, dto, actingUserId) {
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, planId);
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        if (plan.treatment_status !== chemotherapy_constants_1.PLAN_STATUS.PLANNED) {
            throw new Error("Plan items can only be edited while the plan is still PLANNED");
        }
        const item = await this.repository.findPlanItemById(planItemId);
        if (!item || item.chemotherapy_plan_id !== planId) {
            throw new Error("Plan item not found on this plan");
        }
        const itemChanges = {
            ...(dto.drug_role !== undefined ? { drug_role: dto.drug_role } : {}),
            ...(dto.drug_sequence !== undefined ? { drug_sequence: dto.drug_sequence } : {}),
            ...(dto.drug_type !== undefined ? { drug_type: dto.drug_type } : {}),
            ...(dto.dosage !== undefined ? { dosage: dto.dosage } : {}),
            ...(dto.dosage_unit !== undefined ? { dosage_unit: dto.dosage_unit } : {}),
            ...(dto.dose_calculation_method !== undefined ? { dose_calculation_method: dto.dose_calculation_method } : {}),
            ...(dto.calculated_dose !== undefined ? { calculated_dose: dto.calculated_dose } : {}),
            ...(dto.administration_route !== undefined ? { administration_route: dto.administration_route } : {}),
            ...(dto.infusion_duration_minutes !== undefined ? { infusion_duration_minutes: dto.infusion_duration_minutes } : {}),
            ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {})
        };
        await prisma_1.default.$transaction(async (tx) => {
            await this.repository.updatePlanItem(tx, planItemId, itemChanges);
            if (Object.keys(itemChanges).length > 0) {
                await (0, audit_service_1.logAudit)(tx, {
                    entity_type: "chemotherapy_plan_items",
                    entity_id: planItemId,
                    action: audit_types_1.AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: plan.patient_id,
                    branch_id: plan.branch_id,
                    change_summary: (0, audit_service_1.diffFields)(item, itemChanges)
                });
            }
        });
        return this.getPlan(planId);
    }
    async removePlanItem(planId, planItemId, actingUserId) {
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, planId);
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        if (plan.treatment_status !== chemotherapy_constants_1.PLAN_STATUS.PLANNED) {
            throw new Error("Plan items can only be removed while the plan is still PLANNED");
        }
        const item = await this.repository.findPlanItemById(planItemId);
        if (!item || item.chemotherapy_plan_id !== planId) {
            throw new Error("Plan item not found on this plan");
        }
        await prisma_1.default.$transaction(async (tx) => {
            await this.repository.deactivatePlanItem(tx, planItemId);
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_plan_items",
                entity_id: planItemId,
                action: audit_types_1.AUDIT_ACTION.DEACTIVATE,
                performed_by: actingUserId,
                patient_id: plan.patient_id,
                branch_id: plan.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({ medicine_id: item.medicine_id })
            });
        });
        return this.getPlan(planId);
    }
    // ---------------------------------------------------------------
    // Cycles
    // ---------------------------------------------------------------
    async createCycle(planId, dto, actingUserId) {
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, planId);
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        if (chemotherapy_constants_1.PLAN_TERMINAL_STATUSES.includes(plan.treatment_status)) {
            throw new Error(`Cannot create a cycle for a plan that is already ${plan.treatment_status}`);
        }
        if (!dto.cycle_number || dto.cycle_number < 1) {
            throw new Error("cycle_number must be at least 1");
        }
        const cycleId = await prisma_1.default.$transaction(async (tx) => {
            const newCycleId = await this.repository.generateCycleId(tx);
            await this.repository.createCycle(tx, {
                chemotherapy_cycle_id: newCycleId,
                chemotherapy_plan_id: planId,
                cycle_number: dto.cycle_number,
                cycle_day: dto.cycle_day ?? null,
                planned_date: new Date(dto.planned_date),
                cycle_interval_days: dto.cycle_interval_days ?? plan.cycle_interval_days ?? null,
                cycle_status: chemotherapy_constants_1.CYCLE_STATUS.PLANNED,
                completion_status: "PENDING"
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_cycle",
                entity_id: newCycleId,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan.patient_id,
                branch_id: plan.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({ chemotherapy_plan_id: planId, cycle_number: dto.cycle_number, planned_date: dto.planned_date })
            });
            return newCycleId;
        });
        return this.getCycle(cycleId);
    }
    async getCycle(cycleId) {
        const cycle = await this.repository.findCycleById(cycleId);
        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }
        return cycle;
    }
    async listCyclesForPlan(planId) {
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, planId);
        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }
        return this.repository.listCyclesForPlan(planId);
    }
    async updateCycle(cycleId, dto, actingUserId) {
        const cycle = await this.repository.findCycleForUpdate(prisma_1.default, cycleId);
        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }
        if (chemotherapy_constants_1.CYCLE_TERMINAL_STATUSES.includes(cycle.cycle_status)) {
            throw new Error(`Cannot update a cycle that is already ${cycle.cycle_status}`);
        }
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, cycle.chemotherapy_plan_id);
        const cycleChanges = {
            ...(dto.planned_date !== undefined ? { planned_date: new Date(dto.planned_date) } : {}),
            ...(dto.treatment_delay !== undefined ? { treatment_delay: dto.treatment_delay } : {}),
            ...(dto.delay_days !== undefined ? { delay_days: dto.delay_days } : {}),
            ...(dto.delay_reason !== undefined ? { delay_reason: dto.delay_reason } : {}),
            ...(dto.rescheduled_date !== undefined ? { rescheduled_date: dto.rescheduled_date ? new Date(dto.rescheduled_date) : null } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {})
        };
        await prisma_1.default.$transaction(async (tx) => {
            await this.repository.updateCycle(tx, cycleId, cycleChanges);
            if (Object.keys(cycleChanges).length > 0) {
                await (0, audit_service_1.logAudit)(tx, {
                    entity_type: "chemotherapy_cycle",
                    entity_id: cycleId,
                    action: audit_types_1.AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: plan?.patient_id,
                    branch_id: plan?.branch_id,
                    change_summary: (0, audit_service_1.diffFields)(cycle, cycleChanges)
                });
            }
        });
        return this.getCycle(cycleId);
    }
    async changeCycleStatus(cycleId, dto, actingUserId) {
        const cycle = await this.repository.findCycleForUpdate(prisma_1.default, cycleId);
        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }
        if (!isCycleStatus(dto.status)) {
            throw new Error(`status must be one of: ${Object.values(chemotherapy_constants_1.CYCLE_STATUS).join(", ")}`);
        }
        const current = cycle.cycle_status;
        const allowed = chemotherapy_constants_1.CYCLE_STATUS_TRANSITIONS[current] ?? [];
        if (!allowed.includes(dto.status)) {
            throw new Error(`Cannot transition cycle from ${current} to ${dto.status}`);
        }
        if (dto.status === chemotherapy_constants_1.CYCLE_STATUS.CANCELLED && !dto.reason?.trim()) {
            throw new Error("A reason is required to cancel a cycle");
        }
        const planForContext = await this.repository.findPlanForUpdate(prisma_1.default, cycle.chemotherapy_plan_id);
        await prisma_1.default.$transaction(async (tx) => {
            const now = new Date();
            await this.repository.updateCycle(tx, cycleId, {
                cycle_status: dto.status,
                ...(dto.status === chemotherapy_constants_1.CYCLE_STATUS.APPROVED ? { physician_approved: true, approval_date: now } : {}),
                ...(dto.status === chemotherapy_constants_1.CYCLE_STATUS.COMPLETED ? { cycle_completed: true, completion_date: now, completion_status: "COMPLETED" } : {}),
                ...(dto.status === chemotherapy_constants_1.CYCLE_STATUS.CANCELLED ? { cancellation_reason: dto.reason, completion_status: "CANCELLED" } : {}),
                ...(dto.status === chemotherapy_constants_1.CYCLE_STATUS.DELAYED ? { treatment_delay: true, delay_reason: dto.reason } : {}),
                remarks: appendNote(cycle.remarks, dto.reason && dto.status !== chemotherapy_constants_1.CYCLE_STATUS.CANCELLED && dto.status !== chemotherapy_constants_1.CYCLE_STATUS.DELAYED ? `[${dto.status}] ${dto.reason}` : null)
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_cycle",
                entity_id: cycleId,
                action: audit_types_1.AUDIT_ACTION.STATUS_CHANGE,
                performed_by: actingUserId,
                patient_id: planForContext?.patient_id,
                branch_id: planForContext?.branch_id,
                change_summary: (0, audit_service_1.summarizeStatusChange)(current, dto.status, dto.reason)
            });
            if (dto.status === chemotherapy_constants_1.CYCLE_STATUS.COMPLETED) {
                const plan = await this.repository.findPlanForUpdate(tx, cycle.chemotherapy_plan_id);
                if (plan && !chemotherapy_constants_1.PLAN_TERMINAL_STATUSES.includes(plan.treatment_status)) {
                    const completedCycles = (plan.completed_cycles ?? 0) + 1;
                    const allCyclesDone = completedCycles >= plan.planned_cycles;
                    await this.repository.updatePlan(tx, plan.chemotherapy_plan_id, {
                        completed_cycles: completedCycles,
                        ...(allCyclesDone ? { treatment_status: chemotherapy_constants_1.PLAN_STATUS.COMPLETED } : {})
                    });
                    if (allCyclesDone) {
                        await (0, audit_service_1.logAudit)(tx, {
                            entity_type: "chemotherapy_plan",
                            entity_id: plan.chemotherapy_plan_id,
                            action: audit_types_1.AUDIT_ACTION.STATUS_CHANGE,
                            performed_by: actingUserId,
                            patient_id: plan.patient_id,
                            branch_id: plan.branch_id,
                            change_summary: (0, audit_service_1.summarizeStatusChange)(plan.treatment_status ?? chemotherapy_constants_1.PLAN_STATUS.ACTIVE, chemotherapy_constants_1.PLAN_STATUS.COMPLETED, "All planned cycles completed")
                        });
                    }
                }
            }
        });
        return this.getCycle(cycleId);
    }
    // ---------------------------------------------------------------
    // Administration - the only sub-record that mutates cycle/plan status
    // as a side effect (first drug of a cycle moves it to IN_PROGRESS,
    // first drug of a plan moves it to ACTIVE). Never editable/deletable
    // once recorded.
    // ---------------------------------------------------------------
    async recordAdministration(cycleId, dto, actingUserId) {
        const cycle = await this.repository.findCycleForUpdate(prisma_1.default, cycleId);
        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }
        if (!chemotherapy_constants_1.CYCLE_ADMINISTRABLE_STATUSES.includes(cycle.cycle_status)) {
            throw new Error(`Cannot record administration for a cycle in status ${cycle.cycle_status} - the cycle must be APPROVED or IN_PROGRESS`);
        }
        const planItem = await this.repository.findPlanItemById(dto.chemotherapy_plan_item_id);
        if (!planItem) {
            throw new Error("Plan item not found");
        }
        if (planItem.chemotherapy_plan_id !== cycle.chemotherapy_plan_id) {
            throw new Error("This drug does not belong to the plan this cycle is on");
        }
        const administrationId = await prisma_1.default.$transaction(async (tx) => {
            const newId = await this.repository.generateAdministrationId(tx);
            await this.repository.createAdministration(tx, {
                administration_id: newId,
                chemotherapy_cycle_id: cycleId,
                chemotherapy_plan_item_id: dto.chemotherapy_plan_item_id,
                administration_date: new Date(dto.administration_date),
                administration_start_time: dto.administration_start_time ? new Date(dto.administration_start_time) : null,
                administration_end_time: dto.administration_end_time ? new Date(dto.administration_end_time) : null,
                administered_dose: dto.administered_dose ?? null,
                administered_dose_unit: dto.administered_dose_unit ?? null,
                administration_route: dto.administration_route ?? null,
                infusion_rate: dto.infusion_rate ?? null,
                infusion_duration_minutes: dto.infusion_duration_minutes ?? null,
                infusion_completed: dto.infusion_completed ?? false,
                administered_by: dto.administered_by ?? null,
                verified_by: dto.verified_by ?? null,
                iv_site: dto.iv_site ?? null,
                iv_access_type: dto.iv_access_type ?? null,
                cannula_size: dto.cannula_size ?? null,
                peripheral_line: dto.peripheral_line ?? false,
                central_line: dto.central_line ?? false,
                picc_line: dto.picc_line ?? false,
                port_used: dto.port_used ?? false,
                pump_used: dto.pump_used ?? false,
                pump_serial_no: dto.pump_serial_no ?? null,
                oxygen_support: dto.oxygen_support ?? false,
                steroid_given: dto.steroid_given ?? false,
                antihistamine_given: dto.antihistamine_given ?? false,
                antiemetic_given: dto.antiemetic_given ?? false,
                hydration_given: dto.hydration_given ?? false,
                emergency_medication_given: dto.emergency_medication_given ?? false,
                treatment_stopped: dto.treatment_stopped ?? false,
                interruption_reason: dto.interruption_reason ?? null,
                doctor_informed: dto.doctor_informed ?? false,
                nursing_notes: dto.nursing_notes ?? null,
                administration_status: dto.administration_status ?? "Completed",
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });
            if (cycle.cycle_status === chemotherapy_constants_1.CYCLE_STATUS.APPROVED) {
                await this.repository.updateCycle(tx, cycleId, { cycle_status: chemotherapy_constants_1.CYCLE_STATUS.IN_PROGRESS });
            }
            const plan = await this.repository.findPlanForUpdate(tx, cycle.chemotherapy_plan_id);
            if (plan && plan.treatment_status === chemotherapy_constants_1.PLAN_STATUS.PLANNED) {
                await this.repository.updatePlan(tx, plan.chemotherapy_plan_id, { treatment_status: chemotherapy_constants_1.PLAN_STATUS.ACTIVE });
            }
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_administration",
                entity_id: newId,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({
                    chemotherapy_cycle_id: cycleId,
                    chemotherapy_plan_item_id: dto.chemotherapy_plan_item_id,
                    administered_dose: dto.administered_dose ?? null,
                    administered_dose_unit: dto.administered_dose_unit ?? null
                })
            });
            return newId;
        });
        return this.repository.listAdministrationsForCycle(cycleId).then((rows) => rows.find((r) => r.administration_id === administrationId) ?? rows[rows.length - 1]);
    }
    async listAdministrations(cycleId) {
        await this.getCycle(cycleId);
        return this.repository.listAdministrationsForCycle(cycleId);
    }
    // ---------------------------------------------------------------
    // Vitals / adverse events / lab reviews / followups - append-only,
    // no cycle-status gating (they can legitimately be recorded before,
    // during, or after a cycle - e.g. a follow-up visit happens well after
    // the cycle that prompted it is COMPLETED).
    // ---------------------------------------------------------------
    // Looks up the owning plan's patient_id/branch_id for audit context -
    // lighter than this.getCycle() (which eagerly loads every nested
    // administration/vitals/adverse-event/etc array we don't need here).
    async getCyclePlanContext(cycleId) {
        const cycle = await this.repository.findCycleForUpdate(prisma_1.default, cycleId);
        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }
        const plan = await this.repository.findPlanForUpdate(prisma_1.default, cycle.chemotherapy_plan_id);
        return { cycle, plan };
    }
    async recordVitals(cycleId, dto, actingUserId) {
        const { plan } = await this.getCyclePlanContext(cycleId);
        return prisma_1.default.$transaction(async (tx) => {
            const id = await this.repository.generateVitalsId(tx);
            const created = await this.repository.createVitals(tx, {
                vital_id: id,
                chemotherapy_cycle_id: cycleId,
                vital_stage: dto.vital_stage ?? null,
                blood_pressure_systolic: dto.blood_pressure_systolic ?? null,
                blood_pressure_diastolic: dto.blood_pressure_diastolic ?? null,
                pulse_rate: dto.pulse_rate ?? null,
                respiratory_rate: dto.respiratory_rate ?? null,
                body_temperature: dto.body_temperature ?? null,
                spo2: dto.spo2 ?? null,
                height: dto.height ?? null,
                weight: dto.weight ?? null,
                body_surface_area: dto.body_surface_area ?? null,
                bmi: dto.bmi ?? null,
                pain_score: dto.pain_score ?? null,
                pain_location: dto.pain_location ?? null,
                blood_sugar: dto.blood_sugar ?? null,
                oxygen_support: dto.oxygen_support ?? false,
                oxygen_flow_rate: dto.oxygen_flow_rate ?? null,
                consciousness_level: dto.consciousness_level ?? null,
                hydration_status: dto.hydration_status ?? null,
                // recorded_by FKs to employees.employee_id, not user_table.user_id -
                // actingUserId (the JWT subject) is the wrong ID space, so this is
                // left null unless the caller names a real employee_id.
                recorded_by: dto.recorded_by ?? null,
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_vitals",
                entity_id: id,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({ chemotherapy_cycle_id: cycleId, vital_stage: dto.vital_stage ?? null })
            });
            return created;
        });
    }
    async listVitals(cycleId) {
        await this.getCycle(cycleId);
        return this.repository.listVitalsForCycle(cycleId);
    }
    async recordAdverseEvent(cycleId, dto, actingUserId) {
        const { plan } = await this.getCyclePlanContext(cycleId);
        if (!dto.adverse_event_name?.trim()) {
            throw new Error("adverse_event_name is required");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const id = await this.repository.generateAdverseEventId(tx);
            const created = await this.repository.createAdverseEvent(tx, {
                adverse_event_id: id,
                chemotherapy_cycle_id: cycleId,
                event_date: dto.event_date ? new Date(dto.event_date) : new Date(),
                adverse_event_name: dto.adverse_event_name,
                adverse_event_category: dto.adverse_event_category ?? null,
                nausea: dto.nausea ?? false,
                vomiting: dto.vomiting ?? false,
                diarrhea: dto.diarrhea ?? false,
                constipation: dto.constipation ?? false,
                mucositis: dto.mucositis ?? false,
                fever: dto.fever ?? false,
                fatigue: dto.fatigue ?? false,
                neuropathy: dto.neuropathy ?? false,
                alopecia: dto.alopecia ?? false,
                skin_rash: dto.skin_rash ?? false,
                anemia: dto.anemia ?? false,
                neutropenia: dto.neutropenia ?? false,
                thrombocytopenia: dto.thrombocytopenia ?? false,
                infection: dto.infection ?? false,
                bleeding: dto.bleeding ?? false,
                pain: dto.pain ?? false,
                reaction_grade: dto.reaction_grade ?? null,
                ctcae_grade: dto.ctcae_grade ?? null,
                severity: dto.severity ?? null,
                reaction_description: dto.reaction_description ?? null,
                treatment_interrupted: dto.treatment_interrupted ?? false,
                treatment_stopped: dto.treatment_stopped ?? false,
                hospitalization_required: dto.hospitalization_required ?? false,
                icu_required: dto.icu_required ?? false,
                emergency_medication_given: dto.emergency_medication_given ?? false,
                medication_given: dto.medication_given ?? null,
                dose_modified: dto.dose_modified ?? false,
                dose_reduced: dto.dose_reduced ?? false,
                reduction_percentage: dto.reduction_percentage ?? null,
                dose_delayed: dto.dose_delayed ?? false,
                delay_days: dto.delay_days ?? null,
                doctor_action: dto.doctor_action ?? null,
                nursing_action: dto.nursing_action ?? null,
                physician_id: dto.physician_id ?? null,
                // reported_by FKs to employees.employee_id - see recordVitals' note.
                reported_by: dto.reported_by ?? null,
                resolved: dto.resolved ?? false,
                resolution_date: dto.resolution_date ? new Date(dto.resolution_date) : null,
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_adverse_event",
                entity_id: id,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({ chemotherapy_cycle_id: cycleId, adverse_event_name: dto.adverse_event_name, ctcae_grade: dto.ctcae_grade ?? null })
            });
            return created;
        });
    }
    async listAdverseEvents(cycleId) {
        await this.getCycle(cycleId);
        return this.repository.listAdverseEventsForCycle(cycleId);
    }
    async recordLabReview(cycleId, dto, actingUserId) {
        const { plan } = await this.getCyclePlanContext(cycleId);
        return prisma_1.default.$transaction(async (tx) => {
            const id = await this.repository.generateLabReviewId(tx);
            const created = await this.repository.createLabReview(tx, {
                lab_review_id: id,
                chemotherapy_cycle_id: cycleId,
                hemoglobin: dto.hemoglobin ?? null,
                rbc: dto.rbc ?? null,
                wbc: dto.wbc ?? null,
                platelet_count: dto.platelet_count ?? null,
                neutrophil_count: dto.neutrophil_count ?? null,
                anc: dto.anc ?? null,
                creatinine: dto.creatinine ?? null,
                creatinine_clearance: dto.creatinine_clearance ?? null,
                blood_urea: dto.blood_urea ?? null,
                sgot_ast: dto.sgot_ast ?? null,
                sgpt_alt: dto.sgpt_alt ?? null,
                bilirubin: dto.bilirubin ?? null,
                alkaline_phosphatase: dto.alkaline_phosphatase ?? null,
                albumin: dto.albumin ?? null,
                sodium: dto.sodium ?? null,
                potassium: dto.potassium ?? null,
                calcium: dto.calcium ?? null,
                magnesium: dto.magnesium ?? null,
                chloride: dto.chloride ?? null,
                phosphorus: dto.phosphorus ?? null,
                uric_acid: dto.uric_acid ?? null,
                coagulation_profile: dto.coagulation_profile ?? null,
                urine_test_result: dto.urine_test_result ?? null,
                pregnancy_test: dto.pregnancy_test ?? null,
                cbc_normal: dto.cbc_normal ?? true,
                renal_function_ok: dto.renal_function_ok ?? true,
                liver_function_ok: dto.liver_function_ok ?? true,
                chemotherapy_fit: dto.chemotherapy_fit ?? true,
                // reviewed_by FKs to employees.employee_id - see recordVitals' note.
                reviewed_by: dto.reviewed_by ?? null,
                review_notes: dto.review_notes ?? null,
                created_by: actingUserId
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_lab_review",
                entity_id: id,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({ chemotherapy_cycle_id: cycleId, chemotherapy_fit: dto.chemotherapy_fit ?? true })
            });
            return created;
        });
    }
    async listLabReviews(cycleId) {
        await this.getCycle(cycleId);
        return this.repository.listLabReviewsForCycle(cycleId);
    }
    async recordFollowup(cycleId, dto, actingUserId) {
        const { plan } = await this.getCyclePlanContext(cycleId);
        if (!dto.followup_date) {
            throw new Error("followup_date is required");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const id = await this.repository.generateFollowupId(tx);
            const created = await this.repository.createFollowup(tx, {
                followup_id: id,
                chemotherapy_cycle_id: cycleId,
                followup_date: new Date(dto.followup_date),
                next_followup_date: dto.next_followup_date ? new Date(dto.next_followup_date) : null,
                treatment_response: dto.treatment_response ?? null,
                recist_response: dto.recist_response ?? null,
                disease_progression: dto.disease_progression ?? false,
                progression_date: dto.progression_date ? new Date(dto.progression_date) : null,
                progression_details: dto.progression_details ?? null,
                remission_status: dto.remission_status ?? null,
                recurrence: dto.recurrence ?? false,
                recurrence_date: dto.recurrence_date ? new Date(dto.recurrence_date) : null,
                recurrence_site: dto.recurrence_site ?? null,
                metastasis: dto.metastasis ?? false,
                metastasis_site: dto.metastasis_site ?? null,
                survival_status: dto.survival_status ?? null,
                performance_status: dto.performance_status ?? null,
                ongoing_symptoms: dto.ongoing_symptoms ?? null,
                late_toxicity: dto.late_toxicity ?? null,
                supportive_care: dto.supportive_care ?? null,
                followup_notes: dto.followup_notes ?? null,
                physician_assessment: dto.physician_assessment ?? null,
                physician_id: dto.physician_id ?? null,
                created_by: actingUserId
            });
            await (0, audit_service_1.logAudit)(tx, {
                entity_type: "chemotherapy_followup",
                entity_id: id,
                action: audit_types_1.AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: (0, audit_service_1.summarizeCreate)({ chemotherapy_cycle_id: cycleId, treatment_response: dto.treatment_response ?? null, recist_response: dto.recist_response ?? null })
            });
            return created;
        });
    }
    async listFollowups(cycleId) {
        await this.getCycle(cycleId);
        return this.repository.listFollowupsForCycle(cycleId);
    }
}
exports.ChemotherapyService = ChemotherapyService;
