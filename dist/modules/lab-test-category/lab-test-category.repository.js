"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabTestCategoryRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class LabTestCategoryRepository {
    async create(data) {
        return prisma_1.default.lab_test_category.create({
            data
        });
    }
    async findById(lab_test_category_id) {
        return prisma_1.default.lab_test_category.findUnique({
            where: {
                lab_test_category_id
            }
        });
    }
    async findByCode(category_code) {
        return prisma_1.default.lab_test_category.findUnique({
            where: {
                category_code
            }
        });
    }
    async findByName(category_name) {
        return prisma_1.default.lab_test_category.findUnique({
            where: {
                category_name
            }
        });
    }
    async findAll() {
        return prisma_1.default.lab_test_category.findMany({
            orderBy: {
                created_at: "desc"
            }
        });
    }
    async update(lab_test_category_id, data) {
        return prisma_1.default.lab_test_category.update({
            where: {
                lab_test_category_id
            },
            data
        });
    }
    async delete(lab_test_category_id) {
        return prisma_1.default.lab_test_category.delete({
            where: {
                lab_test_category_id
            }
        });
    }
}
exports.LabTestCategoryRepository = LabTestCategoryRepository;
exports.default = new LabTestCategoryRepository();
