"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const department_repository_1 = require("./department.repository");
const departmentRepository = new department_repository_1.DepartmentRepository();
class DepartmentService {
    async getAllDepartments() {
        const departments = await departmentRepository.getAllDepartments();
        return departments.map((department) => ({
            department_id: department.department_id,
            department_name: department.department_name
        }));
    }
    async createDepartment(data) {
        const existingDepartment = await departmentRepository.findDepartmentByName(data.department_name);
        if (existingDepartment) {
            throw new Error("Department already exists");
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            const departmentId = await (0, idGenerator_1.generateId)(tx, "DEPARTMENT");
            const department = await departmentRepository.createDepartment(tx, {
                department_id: departmentId,
                department_name: data.department_name
            });
            return {
                department_id: department.department_id,
                department_name: department.department_name
            };
        });
        return result;
    }
}
exports.DepartmentService = DepartmentService;
