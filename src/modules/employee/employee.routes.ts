import { Router } from "express";
import { EmployeeController } from "./employee.controller";
import { authenticate } from "../../modules/auth/auth.middleware";
import { authorize, authorizeSelfOrPermission, authorizeNoSelf, authorizeSelfPhoto } from "../../middleware/authorize";
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
    authorizeNoSelf("employee.update"),
    branchScope,
    controller.updateEmployee.bind(controller)
);
router.patch(
    "/:employeeId/photo",
    authenticate,
    authorizeSelfPhoto("employee.update"),
    branchScope,
    controller.updateEmployeePhoto.bind(controller)
);
router.delete(
    "/:employeeId",
    authenticate,
    authorizeNoSelf("employee.delete"),
    branchScope,
    controller.softDeleteEmployee.bind(controller)
);
router.delete(
    "/:employeeId/:schedule_id",
    authenticate,
    controller.softDeleteSchedule.bind(controller)
)

export default router;