"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
class SampleCollectionRepository {
    async create(data) {
        const sample_collection_id = await (0, idGenerator_1.generateId)(prisma_1.default, "SAMPLE_COLLECTION");
        return prisma_1.default.sample_collection.create({
            data: { sample_collection_id, ...data }
        });
    }
    async findAll() {
        return prisma_1.default.sample_collection.findMany({
            include: {
                lab_order_item: true,
                employees: true
            },
            orderBy: {
                created_at: "desc"
            }
        });
    }
    async findById(sample_collection_id) {
        return prisma_1.default.sample_collection.findUnique({
            where: {
                sample_collection_id
            },
            include: {
                lab_order_item: true,
                employees: true
            }
        });
    }
    async findByLabOrderItemId(lab_order_item_id) {
        return prisma_1.default.sample_collection.findFirst({
            where: {
                lab_order_item_id
            }
        });
    }
    async findLabOrderItem(lab_order_item_id) {
        return prisma_1.default.lab_order_item.findUnique({
            where: {
                lab_order_item_id
            }
        });
    }
    async findEmployee(employee_id) {
        return prisma_1.default.employees.findUnique({
            where: {
                employee_id
            }
        });
    }
    async update(sample_collection_id, data) {
        return prisma_1.default.sample_collection.update({
            where: {
                sample_collection_id
            },
            data
        });
    }
    async delete(sample_collection_id) {
        return prisma_1.default.sample_collection.delete({
            where: {
                sample_collection_id
            }
        });
    }
    async updateLabOrderItemStatus(lab_order_item_id, item_status) {
        return prisma_1.default.lab_order_item.update({
            where: {
                lab_order_item_id
            },
            data: {
                item_status
            }
        });
    }
}
exports.default = new SampleCollectionRepository();
