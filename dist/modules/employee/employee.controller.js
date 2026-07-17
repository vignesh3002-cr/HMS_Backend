"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeController = void 0;
const employee_service_1 = require("./employee.service");
const service = new employee_service_1.EmployeeService();
class EmployeeController {
    async createEmployee(req, res) {
        try {
            const createdBy = req.user?.role || "SYSTEM";
            const employee = await service.createEmployee(req.body, createdBy);
            return res.status(201).json({
                success: true,
                message: "Employee created successfully",
                data: employee
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getEmployees(req, res) {
        try {
            const employees = await service.getEmployees({
                roleType: req.query.roleType,
                branchId: req.query.branchId,
                department: req.query.department,
                search: req.query.search,
                status: req.query.status !== undefined
                    ? req.query.status === "true"
                    : undefined,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10)
            });
            res.json({
                success: true,
                message: "Employees fetched successfully",
                data: employees
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    ;
    async getEmployeeById(req, res) {
        try {
            const employee = await service.getEmployeeById(req.params.employeeId);
            res.json({
                success: true,
                message: "Employee fetched successfully",
                data: employee
            });
        }
        catch (error) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    ;
}
exports.EmployeeController = EmployeeController;
