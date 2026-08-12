"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DrugRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class DrugRepository {
    async findByCode(code) {
        return prisma_1.default.drug_master.findFirst({
            where: {
                drug_code: code
            }
        });
    }
    async findById(drugId) {
        return prisma_1.default.drug_master.findUnique({
            where: {
                drug_id: drugId
            },
        });
    }
    async findLinkedMedicine(medicineId) {
        return prisma_1.default.medicine_master.findUnique({
            where: {
                medicine_id: medicineId
            }
        });
    }
    async create(tx, data) {
        return tx.drug_master.create({
            data
        });
    }
    async list(query) {
        const { search, drugClass, vesicantStatus, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {
            is_active: true
        };
        if (drugClass) {
            where.drug_class = drugClass;
        }
        if (vesicantStatus) {
            where.vesicant_status = vesicantStatus;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { drug_name: { contains: search, mode: "insensitive" } },
                { drug_code: { contains: search, mode: "insensitive" } },
                { generic_name: { contains: search, mode: "insensitive" } },
                { brand_name: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.drug_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.drug_master.count({ where })
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
    async update(drugId, data) {
        return prisma_1.default.drug_master.update({
            where: { drug_id: drugId },
            data
        });
    }
}
exports.DrugRepository = DrugRepository;
