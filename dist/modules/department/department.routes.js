"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const department_controller_1 = require("./department.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const router = (0, express_1.Router)();
const departmentController = new department_controller_1.DepartmentController();
router.get("/test", (req, res) => {
    res.json({ message: "Department route is working" });
});
router.get("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("department.read"), departmentController.getAllDepartments.bind(departmentController));
router.post("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("department.create"), departmentController.createDepartment.bind(departmentController));
exports.default = router;
