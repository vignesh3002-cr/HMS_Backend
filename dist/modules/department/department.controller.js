"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentController = void 0;
const department_services_1 = require("./department.services");
const departmentService = new department_services_1.DepartmentService();
class DepartmentController {
    async getAllDepartments(req, res) {
        try {
            const departments = await departmentService.getAllDepartments();
            return res.status(200).json({
                success: true,
                data: departments
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}
exports.DepartmentController = DepartmentController;
