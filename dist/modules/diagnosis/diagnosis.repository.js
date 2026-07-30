"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosisRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const diagnosisInclude = {
    patient_bio_data: {
        select: {
            patient_id: true,
            patient_first_name: true,
            patient_last_name: true,
            patient_gender: true,
            patient_dob: true
        }
    },
    branch: {
        select: { branch_id: true, branch_name: true }
    },
    department_master: {
        select: { department_id: true, department_name: true }
    },
    employees: {
        select: { employee_id: true, first_name: true, last_name: true }
    },
    cancer_type_master: {
        select: { cancer_type_id: true, cancer_type_name: true }
    },
    cancer_stage_master: {
        select: { cancer_stage_id: true, stage_name: true }
    },
    tnm_stage_master: {
        select: { tnm_stage_id: true, tnm_combined_code: true }
    },
    histomorphology_master: {
        select: { histomorphology_id: true, morphology_name: true }
    },
    histological_grade_master: {
        select: { histological_grade_id: true, grade_name: true }
    },
    icd_code_master: {
        select: { icd_code_id: true, icd_code: true, icd_description: true }
    }
};
class DiagnosisRepository {
    async findPatient(patientId) {
        return prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId }
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
    async findCancerType(cancerTypeId) {
        return prisma_1.default.cancer_type_master.findUnique({
            where: { cancer_type_id: cancerTypeId }
        });
    }
    async findCancerStage(cancerStageId) {
        return prisma_1.default.cancer_stage_master.findUnique({
            where: { cancer_stage_id: cancerStageId }
        });
    }
    async findTnmStage(tnmStageId) {
        return prisma_1.default.tnm_stage_master.findUnique({
            where: { tnm_stage_id: tnmStageId }
        });
    }
    async findHistomorphology(histomorphologyId) {
        return prisma_1.default.histomorphology_master.findUnique({
            where: { histomorphology_id: histomorphologyId }
        });
    }
    async findHistologicalGrade(histologicalGradeId) {
        return prisma_1.default.histological_grade_master.findUnique({
            where: { histological_grade_id: histologicalGradeId }
        });
    }
    async findIcdCode(icdCodeId) {
        return prisma_1.default.icd_code_master.findUnique({
            where: { icd_code_id: icdCodeId }
        });
    }
    async create(tx, data) {
        return tx.diagnosis.create({
            data,
            include: diagnosisInclude
        });
    }
    async findById(diagnosisId) {
        return prisma_1.default.diagnosis.findUnique({
            where: { diagnosis_id: diagnosisId },
            include: diagnosisInclude
        });
    }
    async list(query) {
        const { patientId, branchId, departmentId, doctorId, cancerTypeId, diagnosisStatus, isActive, search, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (patientId) {
            where.patient_id = patientId;
        }
        if (branchId) {
            where.branch_id = branchId;
        }
        if (departmentId) {
            where.department_id = departmentId;
        }
        if (doctorId) {
            where.diagnosing_doctor_id = doctorId;
        }
        if (cancerTypeId) {
            where.cancer_type_id = cancerTypeId;
        }
        if (diagnosisStatus) {
            where.diagnosis_status = diagnosisStatus;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { primary_site: { contains: search, mode: "insensitive" } },
                { clinical_notes: { contains: search, mode: "insensitive" } },
                { diagnosis_id: { contains: search, mode: "insensitive" } },
                { patient_id: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.diagnosis.findMany({
                where,
                include: diagnosisInclude,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.diagnosis.count({ where })
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
    async update(diagnosisId, data) {
        return prisma_1.default.diagnosis.update({
            where: { diagnosis_id: diagnosisId },
            data,
            include: diagnosisInclude
        });
    }
}
exports.DiagnosisRepository = DiagnosisRepository;
