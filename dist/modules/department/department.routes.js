"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const department_controller_1 = require("./department.controller");
const router = (0, express_1.Router)();
const departmentController = new department_controller_1.DepartmentController();
router.get("/test", (req, res) => {
    res.json({ message: "Department route is working" });
});
router.get("/", departmentController.getAllDepartments.bind(departmentController));
router.post("/", departmentController.createDepartment.bind(departmentController));
exports.default = router;
