"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabOrderItemService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const lab_order_item_repository_1 = require("./lab-order-item.repository");
const repository = new lab_order_item_repository_1.LabOrderItemRepository();
// target_date arrives as an ISO date string ("2026-10-10"); the DATE column
// needs a Date (Prisma rejects a bare date string). Absent = leave unchanged,
// empty/null = clear it.
const toTargetDateData = (target_date) => target_date !== undefined
    ? { target_date: target_date ? new Date(target_date) : null }
    : {};
class LabOrderItemService {
    async create(data) {
        // Check Lab Order
        const order = await prisma_1.default.lab_order.findUnique({
            where: {
                lab_order_id: data.lab_order_id
            }
        });
        if (!order) {
            throw new Error("Lab Order not found");
        }
        // Check Lab Test
        const test = await prisma_1.default.lab_test_master.findUnique({
            where: {
                lab_test_id: data.lab_test_id
            }
        });
        if (!test) {
            throw new Error("Lab Test not found");
        }
        if (test.test_status !== 1) {
            throw new Error("Lab Test is inactive");
        }
        // Generate ID
        const lab_order_item_id = `LOI${Date.now()}`;
        // Read price from Lab Test Master
        const price = Number(test.price ?? 0);
        // Discount
        const discount = Number(data.discount ?? 0);
        // Calculate Net Amount
        const net_amount = price - discount;
        const { target_date, ...rest } = data;
        return repository.create({
            ...rest,
            ...toTargetDateData(target_date),
            lab_order_item_id,
            price,
            net_amount
        });
    }
    async getAll() {
        return repository.findAll();
    }
    async getById(lab_order_item_id) {
        const item = await repository.findById(lab_order_item_id);
        if (!item) {
            throw new Error("Lab Order Item not found");
        }
        return item;
    }
    async update(lab_order_item_id, data) {
        await this.getById(lab_order_item_id);
        const { target_date, ...rest } = data;
        return repository.update(lab_order_item_id, {
            ...rest,
            ...toTargetDateData(target_date)
        });
    }
    async delete(lab_order_item_id) {
        await this.getById(lab_order_item_id);
        return repository.delete(lab_order_item_id);
    }
    async generateBarcodes(items) {
        return repository.generateBarcodes(items);
    }
}
exports.LabOrderItemService = LabOrderItemService;
