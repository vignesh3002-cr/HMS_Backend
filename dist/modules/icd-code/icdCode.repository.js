"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IcdCodeRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class IcdCodeRepository {
    async findByCode(code) {
        return prisma_1.default.icd_code_master.findFirst({
            where: {
                icd_code: code
            }
        });
    }
    async findById(icdCodeId) {
        return prisma_1.default.icd_code_master.findUnique({
            where: {
                icd_code_id: icdCodeId
            }
        });
    }
    async create(tx, data) {
        return tx.icd_code_master.create({
            data
        });
    }
    async list(query) {
        const { search, icdVersion, category, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (icdVersion) {
            where.icd_version = icdVersion;
        }
        if (category) {
            where.icd_category = category;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { icd_code: { contains: search, mode: "insensitive" } },
                { icd_description: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.icd_code_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.icd_code_master.count({ where })
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
    async update(icdCodeId, data) {
        return prisma_1.default.icd_code_master.update({
            where: { icd_code_id: icdCodeId },
            data
        });
    }
}
exports.IcdCodeRepository = IcdCodeRepository;
