"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistomorphologyRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class HistomorphologyRepository {
    async findByCode(code) {
        return prisma_1.default.histomorphology_master.findFirst({
            where: {
                morphology_code: code
            }
        });
    }
    async findById(histomorphologyId) {
        return prisma_1.default.histomorphology_master.findUnique({
            where: {
                histomorphology_id: histomorphologyId
            }
        });
    }
    async create(tx, data) {
        return tx.histomorphology_master.create({
            data
        });
    }
    async list(query) {
        const { search, behavior, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (behavior) {
            where.behavior = behavior;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { morphology_name: { contains: search, mode: "insensitive" } },
                { morphology_code: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.histomorphology_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.histomorphology_master.count({ where })
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
    async update(histomorphologyId, data) {
        return prisma_1.default.histomorphology_master.update({
            where: { histomorphology_id: histomorphologyId },
            data
        });
    }
}
exports.HistomorphologyRepository = HistomorphologyRepository;
