"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HydrationRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class HydrationRepository {
    async findByCode(code) {
        return prisma_1.default.hydration_master.findFirst({
            where: {
                hydration_code: code
            }
        });
    }
    async findById(hydrationId) {
        return prisma_1.default.hydration_master.findUnique({
            where: {
                hydration_id: hydrationId
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
        return tx.hydration_master.create({
            data
        });
    }
    async list(query) {
        const { search, timing, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
        if (timing) {
            where.timing = timing;
        }
        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }
        if (search) {
            where.OR = [
                { fluid_name: { contains: search, mode: "insensitive" } },
                { hydration_code: { contains: search, mode: "insensitive" } }
            ];
        }
        const [records, total] = await Promise.all([
            prisma_1.default.hydration_master.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { [sortBy]: sortOrder }
            }),
            prisma_1.default.hydration_master.count({ where })
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
    async update(hydrationId, data) {
        return prisma_1.default.hydration_master.update({
            where: { hydration_id: hydrationId },
            data
        });
    }
}
exports.HydrationRepository = HydrationRepository;
