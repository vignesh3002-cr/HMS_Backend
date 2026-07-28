"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistologicalGradeRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class HistologicalGradeRepository {
    async findByCode(code) {
        return prisma_1.default.histological_grade_master.findFirst({
            where: {
                grade_code: code
            }
        });
    }
    async findById(histologicalGradeId) {
        return prisma_1.default.histological_grade_master.findUnique({
            where: {
                histological_grade_id: histologicalGradeId
            }
        });
    }
    async create(tx, data) {
        return tx.histological_grade_master.create({
            data
        });
    }
    async list(query) {
        const { search, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { grade_name: { contains: search, mode: "insensitive" } },
                { grade_code: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.histological_grade_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.histological_grade_master.count({ where })
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
    async update(histologicalGradeId, data) {
        return prisma_1.default.histological_grade_master.update({
            where: { histological_grade_id: histologicalGradeId },
            data
        });
    }
}
exports.HistologicalGradeRepository = HistologicalGradeRepository;
