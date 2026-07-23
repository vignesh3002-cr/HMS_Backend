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
    async updateEmployee(req, res) {
        try {
            const employee = await service.updateEmployee(String(req.params.employeeId), req.body);
            return res.status(200).json({
                success: true,
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
    async softDeleteEmployee(req, res) {
        try {
            const result = await service.softDeleteEmployee(String(req.params.employeeId));
            return res.status(200).json({
                success: true,
                message: result.message
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getAllEmployees(req, res) {
        try {
            const query = {
                roleType: req.query.roleType,
                branchId: req.query.branchId,
                department: req.query.department,
                status: req.query.status !== undefined ? req.query.status === "true" : undefined,
                search: req.query.search,
                page: req.query.page ? Number(req.query.page) : 1,
                limit: req.query.limit ? Number(req.query.limit) : 10,
            };
            const result = await service.getEmployees(query);
            return res.status(200).json({
                success: true,
                message: "Employees fetched successfully",
                data: result
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async getEmployeeById(req, res) {
        try {
            console.log("Fetching employee by ID:", req.params.employeeId);
            const employee = await service.getEmployeeById(String(req.params.employeeId));
            return res.status(200).json({
                success: true,
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
}
exports.EmployeeController = EmployeeController;
