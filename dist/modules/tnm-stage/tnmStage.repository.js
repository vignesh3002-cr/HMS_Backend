"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TnmStageRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class TnmStageRepository {
    async findById(tnmStageId) {
        return prisma_1.default.tnm_stage_master.findUnique({
            where: {
                tnm_stage_id: tnmStageId
            },
        });
    }
    async findByCombinedCode(cancerTypeId, combinedCode) {
        return prisma_1.default.tnm_stage_master.findFirst({
            where: {
                cancer_type_id: cancerTypeId,
                tnm_combined_code: combinedCode
            }
        });
    }
    async findCancerType(cancerTypeId) {
        return prisma_1.default.cancer_type_master.findUnique({
            where: {
                cancer_type_id: cancerTypeId
            }
        });
    }
    async create(tx, data) {
        return tx.tnm_stage_master.create({
            data
        });
    }
    async list(query) {
        const { search, cancerTypeId, overallStageGroup, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (cancerTypeId) {
            where.cancer_type_id = cancerTypeId;
        }
        if (overallStageGroup) {
            where.overall_stage_group = overallStageGroup;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { tnm_combined_code: { contains: search, mode: "insensitive" } },
                { overall_stage_group: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.tnm_stage_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.tnm_stage_master.count({ where })
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
    async update(tnmStageId, data) {
        return prisma_1.default.tnm_stage_master.update({
            where: { tnm_stage_id: tnmStageId },
            data
        });
    }
}
exports.TnmStageRepository = TnmStageRepository;
