import { Router } from "express";
import { UserController } from "./user.controller";
import { authenticate } from "../auth.middleware";
import { authorizeRoles } from "../../../middleware/authorize";
import { TOP_LEVEL_ADMIN_ROLES } from "../../../permissions/roles";

const router = Router();

const userController = new UserController();

router.post(
    "/branch_admin",
    authenticate,
    authorizeRoles(...TOP_LEVEL_ADMIN_ROLES),
    userController.createBranchAdmin.bind(userController)
);

export default router;
