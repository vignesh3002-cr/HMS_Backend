"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatmentPlanService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const treatmentPlan_repository_1 = require("./treatmentPlan.repository");
const repository = new treatmentPlan_repository_1.TreatmentPlanRepository();
/**
 * Body Surface Area — Mosteller formula (the most widely used bedside
 * formula for chemotherapy dosing): BSA (m2) = sqrt((height_cm * weight_kg) / 3600)
 */
function calculateBsa(heightCm, weightKg) {
    if (!heightCm || !weightKg) {
        return undefined;
    }
    const bsa = Math.sqrt((heightCm * weightKg) / 3600);
    return Math.round(bsa * 100) / 100;
}
class TreatmentPlanService {
    async validateReferences(data) {
        if (data.protocol_id) {
            const protocol = await repository.findProtocol(data.protocol_id);
            if (!protocol) {
                throw new Error("Chemotherapy protocol not found");
            }
        }
        if (data.treatment_intent_id) {
            const intent = await repository.findTreatmentIntent(data.treatment_intent_id);
            if (!intent) {
                throw new Error("Treatment intent not found");
            }
        }
        if (data.branch_id) {
            const branch = await repository.findBranch(data.branch_id);
            if (!branch) {
                throw new Error("Branch not found");
            }
        }
        if (data.department_id) {
            const department = await repository.findDepartment(data.department_id);
            if (!department) {
                throw new Error("Department not found");
            }
        }
        if (data.planning_doctor_id) {
            const doctor = await repository.findDoctor(data.planning_doctor_id);
            if (!doctor) {
                throw new Error("Planning doctor not found");
            }
        }
    }
    async createTreatmentPlan(data, createdBy) {
        const diagnosis = await repository.findDiagnosis(data.diagnosis_id);
        if (!diagnosis) {
            throw new Error("Diagnosis not found");
        }
        if (diagnosis.patient_id !== data.patient_id) {
            throw new Error("The selected diagnosis does not belong to the given patient");
        }
        const patient = await repository.findPatient(data.patient_id);
        if (!patient) {
            throw new Error("Patient not found");
        }
        await this.validateReferences(data);
        const bsa = data.body_surface_area ??
            calculateBsa(data.height_cm, data.weight_kg);
        return prisma_1.default.$transaction(async (tx) => {
            const treatmentPlanId = await (0, idGenerator_1.generateId)(tx, "TREATMENT_PLAN");
            return tx.treatment_plan.create({
                data: {
                    treatment_plan_id: treatmentPlanId,
                    diagnosis: { connect: { diagnosis_id: data.diagnosis_id } },
                    patient_bio_data: { connect: { patient_id: data.patient_id } },
                    chemo_protocol_master: data.protocol_id
                        ? { connect: { protocol_id: data.protocol_id } }
                        : undefined,
                    treatment_intent_master: data.treatment_intent_id
                        ? { connect: { treatment_intent_id: data.treatment_intent_id } }
                        : undefined,
                    branch: data.branch_id
                        ? { connect: { branch_id: data.branch_id } }
                        : undefined,
                    department_master: data.department_id
                        ? { connect: { department_id: data.department_id } }
                        : undefined,
                    employees: data.planning_doctor_id
                        ? { connect: { employee_id: data.planning_doctor_id } }
                        : undefined,
                    height_cm: data.height_cm,
                    weight_kg: data.weight_kg,
                    body_surface_area: bsa,
                    ecog_performance_status: data.ecog_performance_status,
                    planned_total_cycles: data.planned_total_cycles,
                    cycle_interval_days: data.cycle_interval_days,
                    planned_start_date: data.planned_start_date
                        ? new Date(data.planned_start_date)
                        : undefined,
                    clinical_summary: data.clinical_summary,
                    remarks: data.remarks,
                    plan_status: "Draft",
                    created_by: createdBy
                },
                include: {
                    diagnosis: {
                        select: { diagnosis_id: true, primary_site: true }
                    },
                    patient_bio_data: {
                        select: {
                            patient_id: true,
                            patient_first_name: true,
                            patient_last_name: true
                        }
                    },
                    chemo_protocol_master: {
                        select: { protocol_id: true, protocol_name: true }
                    }
                }
            });
        });
    }
    async getTreatmentPlans(query) {
        return repository.list(query);
    }
    async getTreatmentPlanById(treatmentPlanId) {
        const record = await repository.findById(treatmentPlanId);
        if (!record) {
            throw new Error("Treatment plan not found");
        }
        return record;
    }
    async updateTreatmentPlan(treatmentPlanId, data, updatedBy) {
        const existing = await repository.findById(treatmentPlanId);
        if (!existing) {
            throw new Error("Treatment plan not found");
        }
        await this.validateReferences(data);
        const heightCm = data.height_cm ?? Number(existing.height_cm) || undefined;
        const weightKg = data.weight_kg ?? Number(existing.weight_kg) || undefined;
        const bsa = data.body_surface_area ??
            (data.height_cm || data.weight_kg
                ? calculateBsa(heightCm, weightKg)
                : undefined);
        return repository.update(treatmentPlanId, {
            chemo_protocol_master: data.protocol_id
                ? { connect: { protocol_id: data.protocol_id } }
                : undefined,
            treatment_intent_master: data.treatment_intent_id
                ? { connect: { treatment_intent_id: data.treatment_intent_id } }
                : undefined,
            branch: data.branch_id
                ? { connect: { branch_id: data.branch_id } }
                : undefined,
            department_master: data.department_id
                ? { connect: { department_id: data.department_id } }
                : undefined,
            employees: data.planning_doctor_id
                ? { connect: { employee_id: data.planning_doctor_id } }
                : undefined,
            height_cm: data.height_cm,
            weight_kg: data.weight_kg,
            body_surface_area: bsa,
            ecog_performance_status: data.ecog_performance_status,
            planned_total_cycles: data.planned_total_cycles,
            cycle_interval_days: data.cycle_interval_days,
            planned_start_date: data.planned_start_date
                ? new Date(data.planned_start_date)
                : undefined,
            plan_status: data.plan_status,
            clinical_summary: data.clinical_summary,
            remarks: data.remarks,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    /**
     * Real hospital workflow: a Draft / Pending Approval plan must be
     * formally approved by a senior oncologist/admin before chemotherapy
     * administration can begin against it.
     */
    async approveTreatmentPlan(treatmentPlanId, approvedBy) {
        const existing = await repository.findById(treatmentPlanId);
        if (!existing) {
            throw new Error("Treatment plan not found");
        }
        if (existing.plan_status === "Approved" || existing.plan_status === "Active") {
            throw new Error("Treatment plan is already approved");
        }
        if (existing.plan_status === "Cancelled" || existing.plan_status === "Completed") {
            throw new Error(`Cannot approve a plan that is already ${existing.plan_status}`);
        }
        return repository.update(treatmentPlanId, {
            plan_status: "Approved",
            approved_by: approvedBy,
            approved_date: new Date(),
            updated_by: approvedBy
        });
    }
    async deleteTreatmentPlan(treatmentPlanId, updatedBy) {
        const existing = await repository.findById(treatmentPlanId);
        if (!existing) {
            throw new Error("Treatment plan not found");
        }
        return repository.update(treatmentPlanId, {
            is_active: false,
            plan_status: "Cancelled",
            updated_by: updatedBy
        });
    }
    async restoreTreatmentPlan(treatmentPlanId, updatedBy) {
        const existing = await repository.findById(treatmentPlanId);
        if (!existing) {
            throw new Error("Treatment plan not found");
        }
        return repository.update(treatmentPlanId, {
            is_active: true,
            plan_status: "Draft",
            updated_by: updatedBy
        });
    }
}
exports.TreatmentPlanService = TreatmentPlanService;
