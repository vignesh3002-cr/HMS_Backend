"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabTestCategoryService = void 0;
const lab_test_category_repository_1 = __importDefault(require("./lab-test-category.repository"));
class LabTestCategoryService {
    async create(data) {
        // Check duplicate code
        const codeExists = await lab_test_category_repository_1.default.findByCode(data.category_code);
        if (codeExists) {
            throw new Error("Category Code already exists");
        }
        // Check duplicate name
        const nameExists = await lab_test_category_repository_1.default.findByName(data.category_name);
        if (nameExists) {
            throw new Error("Category Name already exists");
        }
        // Generate Category ID
        const lab_test_category_id = `LTC${Date.now()}`;
        return lab_test_category_repository_1.default.create({
            ...data,
            lab_test_category_id
        });
    }
    async getAll() {
        return lab_test_category_repository_1.default.findAll();
    }
    async getById(id) {
        const category = await lab_test_category_repository_1.default.findById(id);
        if (!category) {
            throw new Error("Category not found");
        }
        return category;
    }
    async update(id, data) {
        await this.getById(id);
        return lab_test_category_repository_1.default.update(id, data);
    }
    async delete(id) {
        await this.getById(id);
        return lab_test_category_repository_1.default.delete(id);
    }
}
exports.LabTestCategoryService = LabTestCategoryService;
exports.default = new LabTestCategoryService();
