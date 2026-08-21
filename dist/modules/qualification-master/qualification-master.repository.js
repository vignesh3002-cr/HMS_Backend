"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualificationMasterRepository = exports.QualificationMasterRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class QualificationMasterRepository {
    async create(data) {
        const now = new Date();
        return prisma_1.default.qualification_master.create({
            data: {
                qualification_id: data.qualification_id,
                qualification_name: data.qualification_name,
                designation: data.designation,
                is_active: data.is_active !== false, // default to true if not specified
                updated_at: now,
            },
        });
    }
    async findAll() {
        return prisma_1.default.qualification_master.findMany({
            where: {
                is_active: true,
            },
            orderBy: {
                qualification_name: "asc",
            },
        });
    }
    async findById(qualification_id) {
        return prisma_1.default.qualification_master.findUnique({
            where: {
                qualification_id,
            },
        });
    }
    async findByQualificationName(qualification_name) {
        return prisma_1.default.qualification_master.findFirst({
            where: {
                qualification_name: {
                    equals: qualification_name,
                    mode: "insensitive",
                },
            },
        });
    }
    async findByDesignation(designation) {
        return prisma_1.default.qualification_master.findMany({
            where: {
                designation,
                is_active: true,
            },
            orderBy: {
                qualification_name: "asc",
            },
        });
    }
    async update(qualification_id, data) {
        const { id: _id, qualification_id: _qualification_id, created_at: _created_at, updated_at: _updated_at, ...updateData } = data;
        return prisma_1.default.qualification_master.update({
            where: {
                qualification_id,
            },
            data: {
                ...updateData,
                updated_at: new Date(),
            },
        });
    }
    async softDelete(qualification_id) {
        return prisma_1.default.qualification_master.update({
            where: {
                qualification_id,
            },
            data: {
                is_active: false,
                updated_at: new Date(),
            },
        });
    }
}
exports.QualificationMasterRepository = QualificationMasterRepository;
exports.qualificationMasterRepository = new QualificationMasterRepository();
