import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetTreatmentPlansQuery } from "./treatmentPlan.types";

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

} satisfies Prisma.treatment_planInclude;

export class TreatmentPlanRepository {

    async findDiagnosis(diagnosisId: string) {

        return prisma.diagnosis.findUnique({
            where: { diagnosis_id: diagnosisId }
        });

    }

    async findPatient(patientId: string) {

        return prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId }
        });

    }

    async findProtocol(protocolId: string) {

        return prisma.chemo_protocol_master.findUnique({
            where: { protocol_id: protocolId }
        });

    }

    async findTreatmentIntent(treatmentIntentId: string) {

        return prisma.treatment_intent_master.findUnique({
            where: { treatment_intent_id: treatmentIntentId }
        });

    }

    async findBranch(branchId: string) {

        return prisma.branch.findUnique({ where: { branch_id: branchId } });

    }

    async findDepartment(departmentId: string) {

        return prisma.department_master.findUnique({
            where: { department_id: departmentId }
        });

    }

    async findDoctor(employeeId: string) {

        return prisma.employees.findUnique({ where: { employee_id: employeeId } });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.treatment_planCreateInput) {

        return tx.treatment_plan.create({
            data,
            include: treatmentPlanInclude
        });

    }

    async findById(treatmentPlanId: string) {

        return prisma.treatment_plan.findUnique({
            where: { treatment_plan_id: treatmentPlanId },
            include: treatmentPlanInclude
        });

    }

    async list(query: GetTreatmentPlansQuery) {

        const {
            patientId,
            diagnosisId,
            protocolId,
            planStatus,
            branchId,
            doctorId,
            isActive,
            search,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.treatment_planWhereInput = {};

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

            prisma.treatment_plan.findMany({

                where,

                include: treatmentPlanInclude,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.treatment_plan.count({ where })

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

    async update(treatmentPlanId: string, data: Prisma.treatment_planUpdateInput) {

        return prisma.treatment_plan.update({
            where: { treatment_plan_id: treatmentPlanId },
            data,
            include: treatmentPlanInclude
        });

    }

}
