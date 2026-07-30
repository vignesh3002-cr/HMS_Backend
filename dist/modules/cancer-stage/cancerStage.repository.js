"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancerStageRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class CancerStageRepository {
    async findByCode(code) {
        return prisma_1.default.cancer_stage_master.findFirst({
            where: {
                stage_code: code
            }
        });
    }
    async findById(cancerStageId) {
        return prisma_1.default.cancer_stage_master.findUnique({
            where: {
                cancer_stage_id: cancerStageId
            }
        });
    }
    async create(tx, data) {
        return tx.cancer_stage_master.create({
            data
        });
    }
    async list(query) {
        const { search, stageGroup, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (stageGroup) {
            where.stage_group = stageGroup;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { stage_name: { contains: search, mode: "insensitive" } },
                { stage_code: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.cancer_stage_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.cancer_stage_master.count({ where })
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
    async update(cancerStageId, data) {
        return prisma_1.default.cancer_stage_master.update({
            where: { cancer_stage_id: cancerStageId },
            data
        });
    }
}
exports.CancerStageRepository = CancerStageRepository;
