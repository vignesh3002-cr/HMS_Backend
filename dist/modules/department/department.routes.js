"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const department_controller_1 = require("./department.controller");
const router = (0, express_1.Router)();
const departmentController = new department_controller_1.DepartmentController();
router.get("/", departmentController.getAllDepartments.bind(departmentController));
exports.default = router;
