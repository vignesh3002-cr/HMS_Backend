"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancerTypeRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class CancerTypeRepository {
    async findByCode(code) {
        return prisma_1.default.cancer_type_master.findFirst({
            where: {
                cancer_type_code: code
            }
        });
    }
    async findByName(name) {
        return prisma_1.default.cancer_type_master.findFirst({
            where: {
                cancer_type_name: {
                    equals: name,
                    mode: "insensitive"
                }
            }
        });
    }
    async findById(cancerTypeId) {
        return prisma_1.default.cancer_type_master.findUnique({
            where: {
                cancer_type_id: cancerTypeId
            }
        });
    }
    async create(tx, data) {
        return tx.cancer_type_master.create({
            data
        });
    }
    async list(query) {
        const { search, category, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (category) {
            where.cancer_category = category;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                {
                    cancer_type_name: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    cancer_type_code: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    icd_o3_code: {
                        contains: search,
                        mode: "insensitive"
                    }
                }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.cancer_type_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    [sortBy]: sortOrder
                }
            }),
            prisma_1.default.cancer_type_master.count({ where })
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
    async update(cancerTypeId, data) {
        return prisma_1.default.cancer_type_master.update({
            where: {
                cancer_type_id: cancerTypeId
            },
            data: {
                cancer_type_name: data.cancer_type_name,
                cancer_category: data.cancer_category,
                icd_o3_code: data.icd_o3_code,
                description: data.description,
                is_active: data.is_active,
                updated_at: new Date()
            }
        });
    }
}
exports.CancerTypeRepository = CancerTypeRepository;
