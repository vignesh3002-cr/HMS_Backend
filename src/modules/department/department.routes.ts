import { Router } from "express";
import { DepartmentController } from "./department.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";

const router = Router();
const departmentController = new DepartmentController();

router.get("/test", (req, res) => {
    res.json({ message: "Department route is working" });
});

// Listing departments requires only authentication: it is non-sensitive
// reference data (id/name pairs) needed by doctor-facing forms such as the
// schedule slot modal, and the DOCTOR role has no department.read grant.
router.get(
    "/",
    authenticate,
    departmentController.getAllDepartments.bind(departmentController)
);

router.post(
    "/",
    authenticate,
    authorize("department.create"),
    departmentController.createDepartment.bind(departmentController)
);

export default router;