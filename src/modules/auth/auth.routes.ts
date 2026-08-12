import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "./auth.middleware";
import { authorizeRoles } from "../../middleware/authorize";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";


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
    (req, res) => {

        return res.json({
            success: true,
            user: (req as any).user
        });

    }
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