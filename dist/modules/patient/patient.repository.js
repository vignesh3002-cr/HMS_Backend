"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class PatientRepository {
    async findUsername(username) {
        return prisma_1.default.user_table.findFirst({
            where: {
                username
            }
        });
    }
    async findMobile(mobile) {
        return prisma_1.default.patient_bio_data.findFirst({
            where: {
                patient_primary_mobile: mobile
            }
        });
    }
    async findEmail(email) {
        return prisma_1.default.patient_bio_data.findFirst({
            where: {
                patient_email: email
            }
        });
    }
    async findBranch(branchId) {
        return prisma_1.default.branch.findUnique({
            where: {
                branch_id: branchId
            }
        });
    }
    async getPatients(query) {
        const { branchId, patientType, status, search, page = 1, limit = 10 } = query;
        const where = {};
        if (branchId) {
            where.branch_id = branchId;
        }
        if (patientType) {
            where.patient_type = patientType;
        }
        if (status) {
            where.patient_active = status;
        }
        if (search) {
            where.OR = [
                {
                    patient_first_name: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    patient_last_name: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    patient_email: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    patient_primary_mobile: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    patient_id: {
                        contains: search,
                        mode: "insensitive"
                    }
                }
            ];
        }
        const patients = await prisma_1.default.patient_bio_data.findMany({
            where,
            include: {
                branch: {
                    select: {
                        branch_name: true
                    }
                },
                user_table: {
                    select: {
                        role_type: true,
                        user_status: true
                    }
                }
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                id: "desc"
            }
        });
        const total = await prisma_1.default.patient_bio_data.count({
            where
        });
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            patients
        };
    }
    async getPatientById(patientId) {
        return prisma_1.default.patient_bio_data.findUnique({
            where: {
                patient_id: patientId
            },
            include: {
                branch: true,
                user_table: true
            }
        });
    }
    async updatePatient(patientId, data) {
        return prisma_1.default.patient_bio_data.update({
            where: {
                patient_id: patientId
            },
            data
        });
    }
}
exports.PatientRepository = PatientRepository;
