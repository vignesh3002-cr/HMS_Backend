"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualificationMasterRepository = exports.QualificationMasterRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class QualificationMasterRepository {
    async create(data) {
        return prisma_1.default.qualification_master.create({
            data,
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
        return prisma_1.default.qualification_master.update({
            where: {
                qualification_id,
            },
            data,
        });
    }
    async softDelete(qualification_id) {
        return prisma_1.default.qualification_master.update({
            where: {
                qualification_id,
            },
            data: {
                is_active: false,
            },
        });
    }
}
exports.QualificationMasterRepository = QualificationMasterRepository;
exports.qualificationMasterRepository = new QualificationMasterRepository();
