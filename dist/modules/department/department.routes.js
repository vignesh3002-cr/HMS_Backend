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
// Listing departments requires only authentication: it is non-sensitive
// reference data (id/name pairs) needed by doctor-facing forms such as the
// schedule slot modal, and the DOCTOR role has no department.read grant.
router.get("/", auth_middleware_1.authenticate, departmentController.getAllDepartments.bind(departmentController));
router.post("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("department.create"), departmentController.createDepartment.bind(departmentController));
exports.default = router;
