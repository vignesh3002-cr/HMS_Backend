import { Router } from "express";
import { DepartmentController } from "./department.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";

const router = Router();
const departmentController = new DepartmentController();

router.get("/test", (req, res) => {
    res.json({ message: "Department route is working" });
});

router.get(
    "/",
    authenticate,
    authorize("department.read"),
    departmentController.getAllDepartments.bind(departmentController)
);

router.post(
    "/",
    authenticate,
    authorize("department.create"),
    departmentController.createDepartment.bind(departmentController)
);

export default router;