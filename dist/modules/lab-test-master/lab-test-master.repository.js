"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../../config/prisma"));
class LabTestMasterRepository {
    async create(data) {
        return prisma_1.default.lab_test_master.create({
            data
        });
    }
    async findById(lab_test_id) {
        return prisma_1.default.lab_test_master.findUnique({
            where: {
                lab_test_id
            }
        });
    }
    async findByCode(test_code) {
        return prisma_1.default.lab_test_master.findUnique({
            where: {
                test_code
            }
        });
    }
    async findByName(test_name) {
        return prisma_1.default.lab_test_master.findFirst({
            where: {
                test_name
            }
        });
    }
    async findCategory(lab_test_category_id) {
        return prisma_1.default.lab_test_category.findUnique({
            where: {
                lab_test_category_id
            }
        });
    }
    async findAll() {
        return prisma_1.default.lab_test_master.findMany({
            include: {
                lab_test_category: true
            },
            orderBy: {
                created_at: "desc"
            }
        });
    }
    async update(lab_test_id, data) {
        return prisma_1.default.lab_test_master.update({
            where: {
                lab_test_id
            },
            data
        });
    }
    async delete(lab_test_id) {
        return prisma_1.default.lab_test_master.delete({
            where: {
                lab_test_id
            }
        });
    }
}
exports.default = new LabTestMasterRepository();
