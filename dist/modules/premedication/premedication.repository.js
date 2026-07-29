"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremedicationRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class PremedicationRepository {
    async findByCode(code) {
        return prisma_1.default.premedication_master.findFirst({
            where: {
                premed_code: code
            }
        });
    }
    async findById(premedicationId) {
        return prisma_1.default.premedication_master.findUnique({
            where: {
                premedication_id: premedicationId
            },
            include: {
                medicine_master: {
                    select: {
                        medicine_id: true,
                        medicine_name: true
                    }
                }
            }
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
        return tx.premedication_master.create({
            data
        });
    }
    async list(query) {
        const { search, category, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (category) {
            where.premed_category = category;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { premed_name: { contains: search, mode: "insensitive" } },
                { premed_code: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.premedication_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.premedication_master.count({ where })
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
    async update(premedicationId, data) {
        return prisma_1.default.premedication_master.update({
            where: { premedication_id: premedicationId },
            data
        });
    }
}
exports.PremedicationRepository = PremedicationRepository;
