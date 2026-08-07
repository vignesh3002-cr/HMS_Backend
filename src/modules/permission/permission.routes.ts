import { Router } from "express";
import { PermissionController } from "./permission.controller";
import { authenticate } from "../../modules/auth/auth.middleware";
import { authorize } from "../../middleware/authorize";

const router = Router();
const controller = new PermissionController();

router.get(
  "/matrix",
  authenticate,
  authorize("permission.manage"),
  controller.getMatrix.bind(controller)
);

router.post(
  "/grant",
  authenticate,
  authorize("permission.manage"),
  controller.grantPermission.bind(controller)
);

router.post(
  "/revoke",
  authenticate,
  authorize("permission.manage"),
  controller.revokePermission.bind(controller)
);

router.post(
  "/bulk",
  authenticate,
  authorize("permission.manage"),
  controller.bulkUpdatePermissions.bind(controller)
);

router.get(
  "/my-permissions",
  authenticate,
  controller.getMyPermissions.bind(controller)
);

router.get(
  "/audit",
  authenticate,
  authorize("permission.manage"),
  controller.getAuditLog.bind(controller)
);

export default router;