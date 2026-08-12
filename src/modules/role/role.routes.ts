import { Router } from "express";
import { RoleController } from "./role.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";

const router = Router();
const controller = new RoleController();

router.get(
  "/",
  authenticate,
  authorize("permission.manage"),
  controller.listRoles.bind(controller)
);

router.patch(
  "/:roleType",
  authenticate,
  authorize("permission.manage"),
  controller.updateRole.bind(controller)
);

export default router;
