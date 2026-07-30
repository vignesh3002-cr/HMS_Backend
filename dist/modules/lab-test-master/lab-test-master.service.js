"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lab_test_master_repository_1 = __importDefault(require("./lab-test-master.repository"));
class LabTestMasterService {
    async create(data) {
        // Check Category
        const category = await lab_test_master_repository_1.default.findCategory(data.lab_test_category_id);
        if (!category) {
            throw new Error("Lab Test Category not found");
        }
        // Check Duplicate Test Code
        const code = await lab_test_master_repository_1.default.findByCode(data.test_code);
        if (code) {
            throw new Error("Test Code already exists");
        }
        // Check Duplicate Test Name
        const name = await lab_test_master_repository_1.default.findByName(data.test_name);
        if (name) {
            throw new Error("Test Name already exists");
        }
        // Generate Lab Test ID
        const lab_test_id = `LABTEST${Date.now()}`;
        return lab_test_master_repository_1.default.create({
            ...data,
            lab_test_id
        });
    }
    async getAll() {
        return lab_test_master_repository_1.default.findAll();
    }
    async getById(id) {
        const test = await lab_test_master_repository_1.default.findById(id);
        if (!test) {
            throw new Error("Lab Test not found");
        }
        return test;
    }
    async update(id, data) {
        await this.getById(id);
        return lab_test_master_repository_1.default.update(id, data);
    }
    async delete(id) {
        await this.getById(id);
        return lab_test_master_repository_1.default.delete(id);
    }
}
exports.default = new LabTestMasterService();
