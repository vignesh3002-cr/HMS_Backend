"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatmentIntentRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class TreatmentIntentRepository {
    async findByCode(code) {
        return prisma_1.default.treatment_intent_master.findFirst({
            where: {
                intent_code: code
            }
        });
    }
    async findById(treatmentIntentId) {
        return prisma_1.default.treatment_intent_master.findUnique({
            where: {
                treatment_intent_id: treatmentIntentId
            }
        });
    }
    async create(tx, data) {
        return tx.treatment_intent_master.create({
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
                { intent_name: { contains: search, mode: "insensitive" } },
                { intent_code: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.treatment_intent_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.treatment_intent_master.count({ where })
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
    async update(treatmentIntentId, data) {
        return prisma_1.default.treatment_intent_master.update({
            where: { treatment_intent_id: treatmentIntentId },
            data
        });
    }
}
exports.TreatmentIntentRepository = TreatmentIntentRepository;
