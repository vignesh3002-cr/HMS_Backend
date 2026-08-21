import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "./auth.middleware";
import { authorizeRoles } from "../../middleware/authorize";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";
import prisma from "../../config/prisma";


const router = Router();

const authController = new AuthController();

router.post(
    "/login",
    authController.login.bind(authController)
);
router.post(
    "/send-otp",
    authController.sendOtp.bind(authController)
);
router.post(
    "/verify-otp",
    authController.verifyOtp.bind(authController)
);
router.get(
    "/me",
    authenticate,
    async (req, res) => {

        const authUser = (req as any).user;

        // employee_id isn't in the JWT payload -- the frontend needs it to
        // link "Edit Profile" to this user's own /doctor/edit/:id or
        // /staff/edit/:id record. Not present for PATIENT logins.
        const employee = await prisma.employees.findUnique({
            where: { user_id: authUser?.user_id },
            select: { employee_id: true },
        });

        return res.json({
            success: true,
            user: {
                ...authUser,
                employee_id: employee?.employee_id ?? null,
            },
        });

    }
);
router.patch(
    "/me/username",
    authenticate,
    authController.changeUsername.bind(authController)
);
router.patch(
    "/me/password",
    authenticate,
    authController.changePassword.bind(authController)
);
router.get(
  "/admin",
  authenticate,
  authorizeRoles(...TOP_LEVEL_ADMIN_ROLES),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome Admin"
    });
  }
);

export default router;