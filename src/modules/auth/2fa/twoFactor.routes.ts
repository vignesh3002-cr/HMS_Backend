import { Router } from "express";
import { authenticate } from "../auth.middleware";
import { twoFactorController } from "./twoFactor.controller";

const router = Router();

// Public login endpoints (for Authenticate.tsx "Try another way")
router.post("/methods", twoFactorController.getAvailableLoginMethods.bind(twoFactorController));
router.post("/resend-login-otp", twoFactorController.resendLoginOtp.bind(twoFactorController));
router.post("/verify-custom-login", twoFactorController.verifyCustomLoginFactor.bind(twoFactorController));

// Authenticated 2FA status and management
router.get("/status", authenticate, twoFactorController.getStatus.bind(twoFactorController));
router.post("/totp/setup", authenticate, twoFactorController.setupTotp.bind(twoFactorController));
router.post("/totp/confirm", authenticate, twoFactorController.confirmTotp.bind(twoFactorController));
router.post("/disable", authenticate, twoFactorController.disableTwoFactor.bind(twoFactorController));

// Step 1: Default-channel authorization for adding alternate contact
router.post("/alternate/request-auth-otp", authenticate, twoFactorController.requestAddAlternateAuthOtp.bind(twoFactorController));
router.post("/alternate/verify-auth-otp", authenticate, twoFactorController.verifyAddAlternateAuthOtp.bind(twoFactorController));

// Alternate Email
router.post("/alternate-email/send-otp", authenticate, twoFactorController.sendAlternateEmailOtp.bind(twoFactorController));
router.post("/alternate-email/confirm", authenticate, twoFactorController.confirmAlternateEmail.bind(twoFactorController));
router.delete("/alternate-email", authenticate, twoFactorController.removeAlternateEmail.bind(twoFactorController));

// Alternate Mobile
router.post("/alternate-mobile/send-otp", authenticate, twoFactorController.sendAlternateMobileOtp.bind(twoFactorController));
router.post("/alternate-mobile/confirm", authenticate, twoFactorController.confirmAlternateMobile.bind(twoFactorController));
router.delete("/alternate-mobile", authenticate, twoFactorController.removeAlternateMobile.bind(twoFactorController));

// Routing Preferences
router.put("/preferences", authenticate, twoFactorController.updatePreferences.bind(twoFactorController));

// Password Change Multi-Phase OTP
router.post("/password/request-otp", authenticate, twoFactorController.requestPasswordChangeOtp.bind(twoFactorController));
router.post("/password/verify-otp", authenticate, twoFactorController.verifyPasswordChangeOtp.bind(twoFactorController));
router.patch("/password/finalize", authenticate, twoFactorController.finalizePasswordChange.bind(twoFactorController));

export default router;
