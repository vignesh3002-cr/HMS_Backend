"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employee_controller_1 = require("./employee.controller");
const auth_middleware_1 = require("../../modules/auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const branchScope_1 = require("../../middleware/branchScope");
<<<<<<< HEAD
const router = (0, express_1.Router)();
const controller = new employee_controller_1.EmployeeController();
router.post("/create", auth_middleware_1.authenticate, (0, authorize_1.authorize)("employee.create"), controller.createEmployee.bind(controller));
router.get("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("employee.read"), branchScope_1.branchScope, controller.getAllEmployees.bind(controller));
router.get("/:employeeId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("employee.read"), branchScope_1.branchScope, controller.getEmployeeById.bind(controller));
router.put("/:employeeId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("employee.update"), branchScope_1.branchScope, controller.updateEmployee.bind(controller));
router.delete("/:employeeId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("employee.delete"), branchScope_1.branchScope, controller.softDeleteEmployee.bind(controller));
=======
const roles_1 = require("../../permissions/roles");
const router = (0, express_1.Router)();
const controller = new employee_controller_1.EmployeeController();
router.post("/create", auth_middleware_1.authenticate, (0, authorize_1.authorize)(...roles_1.TOP_LEVEL_ADMIN_ROLES), controller.createEmployee.bind(controller));
router.get("/", auth_middleware_1.authenticate, branchScope_1.branchScope, controller.getAllEmployees.bind(controller));
router.get("/:employeeId", auth_middleware_1.authenticate, branchScope_1.branchScope, controller.getEmployeeById.bind(controller));
router.put("/:employeeId", auth_middleware_1.authenticate, branchScope_1.branchScope, controller.updateEmployee.bind(controller));
router.delete("/:employeeId", auth_middleware_1.authenticate, branchScope_1.branchScope, controller.softDeleteEmployee.bind(controller));
>>>>>>> a430ca9ba6608e611b8e0041162a90cf3433d7ed
exports.default = router;
