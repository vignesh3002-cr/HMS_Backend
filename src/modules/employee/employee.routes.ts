import { Router } from "express";
import { EmployeeController } from "./employee.controller";
import { authenticate } from "../../modules/auth/auth.middleware";
import { authorize, authorizeSelfOrPermission } from "../../middleware/authorize";
import { branchScope } from "../../middleware/branchScope";

const router = Router();

const controller = new EmployeeController();

router.post(
    "/create",
    authenticate,
    authorize("employee.create"),
    controller.createEmployee.bind(controller)
);
router.get(
    "/",
    authenticate,
    authorize("employee.read"),
    branchScope,
    controller.getAllEmployees.bind(controller)
);
router.get(
    "/:employeeId",
    authenticate,
    authorizeSelfOrPermission("employee.read"),
    branchScope,
    controller.getEmployeeById.bind(controller)
);

router.put(
    "/:employeeId",
    authenticate,
    authorizeSelfOrPermission("employee.update"),
    branchScope,
    controller.updateEmployee.bind(controller)
);
router.delete(
    "/:employeeId",
    authenticate,
    authorize("employee.delete"),
    branchScope,
    controller.softDeleteEmployee.bind(controller)
);

export default router;