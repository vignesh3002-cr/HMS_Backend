"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentService = void 0;
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
}
exports.DepartmentService = DepartmentService;
