"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabOrderItemRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class LabOrderItemRepository {
    async create(data) {
        return prisma_1.default.lab_order_item.create({
            data
        });
    }
    async findAll() {
        return prisma_1.default.lab_order_item.findMany({
            include: {
                lab_order: true,
                lab_test_master: true
            }
        });
    }
    async findById(lab_order_item_id) {
        return prisma_1.default.lab_order_item.findUnique({
            where: {
                lab_order_item_id
            },
            include: {
                lab_order: true,
                lab_test_master: true
            }
        });
    }
    async update(lab_order_item_id, data) {
        return prisma_1.default.lab_order_item.update({
            where: {
                lab_order_item_id
            },
            data
        });
    }
    async delete(lab_order_item_id) {
        return prisma_1.default.lab_order_item.delete({
            where: {
                lab_order_item_id
            }
        });
    }
}
exports.LabOrderItemRepository = LabOrderItemRepository;
