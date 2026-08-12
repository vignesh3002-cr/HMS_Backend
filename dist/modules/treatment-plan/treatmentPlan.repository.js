"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatmentPlanRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const treatmentPlanInclude = {
    diagnosis: {
        select: {
            diagnosis_id: true,
            primary_site: true,
            diagnosis_status: true,
            cancer_type_master: {
                select: { cancer_type_id: true, cancer_type_name: true }
            },
            cancer_stage_master: {
                select: { cancer_stage_id: true, stage_name: true }
            }
        }
    },
    patient_bio_data: {
        select: {
            patient_id: true,
            patient_first_name: true,
            patient_last_name: true
        }
    },
    chemo_protocol_master: {
        select: {
            protocol_id: true,
            protocol_code: true,
            protocol_name: true,
            cycle_length_days: true,
            chemo_protocol_drug: {
                where: { is_active: true },
                orderBy: { sequence_order: "asc" },
                include: {
                    drug_master: {
                        select: { drug_id: true, drug_name: true }
                    }
                }
            }
        }
    },
    treatment_intent_master: {
        select: { treatment_intent_id: true, intent_name: true }
    },
    branch: {
        select: { branch_id: true, branch_name: true }
    },
    department_master: {
        select: { department_id: true, department_name: true }
    },
    employees: {
        select: { employee_id: true, first_name: true, last_name: true }
    }
};
class TreatmentPlanRepository {
    async findDiagnosis(diagnosisId) {
        return prisma_1.default.diagnosis.findUnique({
            where: { diagnosis_id: diagnosisId }
        });
    }
    async findPatient(patientId) {
        return prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId }
        });
    }
    async findProtocol(protocolId) {
        return prisma_1.default.chemo_protocol_master.findUnique({
            where: { protocol_id: protocolId }
        });
    }
    async findTreatmentIntent(treatmentIntentId) {
        return prisma_1.default.treatment_intent_master.findUnique({
            where: { treatment_intent_id: treatmentIntentId }
        });
    }
    async findBranch(branchId) {
        return prisma_1.default.branch.findUnique({ where: { branch_id: branchId } });
    }
    async findDepartment(departmentId) {
        return prisma_1.default.department_master.findUnique({
            where: { department_id: departmentId }
        });
    }
    async findDoctor(employeeId) {
        return prisma_1.default.employees.findUnique({ where: { employee_id: employeeId } });
    }
    async create(tx, data) {
        return tx.treatment_plan.create({
            data,
            include: treatmentPlanInclude
        });
    }
    async findById(treatmentPlanId) {
        return prisma_1.default.treatment_plan.findUnique({
            where: { treatment_plan_id: treatmentPlanId },
            include: treatmentPlanInclude
        });
    }
    async list(query) {
        const { patientId, diagnosisId, protocolId, planStatus, branchId, doctorId, isActive, search, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (patientId) {
            where.patient_id = patientId;
        }
        if (diagnosisId) {
            where.diagnosis_id = diagnosisId;
        }
        if (protocolId) {
            where.protocol_id = protocolId;
        }
        if (planStatus) {
            where.plan_status = planStatus;
        }
        if (branchId) {
            where.branch_id = branchId;
        }
        if (doctorId) {
            where.planning_doctor_id = doctorId;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { treatment_plan_id: { contains: search, mode: "insensitive" } },
                { patient_id: { contains: search, mode: "insensitive" } },
                { clinical_summary: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.treatment_plan.findMany({
                where,
                include: treatmentPlanInclude,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.treatment_plan.count({ where })
        ]);
        return {
            records,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    async update(treatmentPlanId, data) {
        return prisma_1.default.treatment_plan.update({
            where: { treatment_plan_id: treatmentPlanId },
            data,
            include: treatmentPlanInclude
        });
    }
}
exports.TreatmentPlanRepository = TreatmentPlanRepository;
