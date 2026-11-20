import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "./auth.middleware";
import { authorizeRoles } from "../../middleware/authorize";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";
import prisma from "../../config/prisma";
import twoFactorRoutes from "./2fa/twoFactor.routes";
import { twoFactorController } from "./2fa/twoFactor.controller";

const router = Router();

const authController = new AuthController();

// 2FA and Multi-Channel Security Subsystem
router.use("/2fa", twoFactorRoutes);

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

// Forgot Password Flow (Unauthenticated: Username -> Default Channel OTP -> Reset)
router.post(
    "/forgot-password/request-otp",
    twoFactorController.requestForgotPasswordOtp.bind(twoFactorController)
);
router.post(
    "/forgot-password/verify-otp",
    twoFactorController.verifyForgotPasswordOtp.bind(twoFactorController)
);
router.post(
    "/forgot-password/reset",
    twoFactorController.finalizeForgotPassword.bind(twoFactorController)
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
// Sector 2: Username change disabled from user self-service
router.patch(
    "/me/username",
    authenticate,
    (_req, res) => {
        res.status(403).json({
            success: false,
            message: "Username cannot be changed. Please contact your system administrator.",
        });
    }
);

// Sector 3: Password change with Old Password + OTP verification
router.post(
    "/me/password/request-otp",
    authenticate,
    twoFactorController.requestPasswordChangeOtp.bind(twoFactorController)
);
router.post(
    "/me/password/verify-otp",
    authenticate,
    twoFactorController.verifyPasswordChangeOtp.bind(twoFactorController)
);
router.patch(
    "/me/password",
    authenticate,
    twoFactorController.finalizePasswordChange.bind(twoFactorController)
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
router.get(
  "/me/kpi-preferences",
  authenticate,
  authController.getKpiPreferences.bind(authController)
);
router.put(
  "/me/kpi-preferences",
  authenticate,
  authController.saveKpiPreferences.bind(authController)
);
router.get(
  "/me/kpi-usage",
  authenticate,
  authController.getKpiUsage.bind(authController)
);
router.put(
  "/me/kpi-usage",
  authenticate,
  authController.saveKpiUsage.bind(authController)
);

export default router;