"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth.middleware");
const twoFactor_controller_1 = require("./twoFactor.controller");
const router = (0, express_1.Router)();
// Public login endpoints (for Authenticate.tsx "Try another way")
router.post("/methods", twoFactor_controller_1.twoFactorController.getAvailableLoginMethods.bind(twoFactor_controller_1.twoFactorController));
router.post("/resend-login-otp", twoFactor_controller_1.twoFactorController.resendLoginOtp.bind(twoFactor_controller_1.twoFactorController));
router.post("/verify-custom-login", twoFactor_controller_1.twoFactorController.verifyCustomLoginFactor.bind(twoFactor_controller_1.twoFactorController));
// Authenticated 2FA status and management
router.get("/status", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.getStatus.bind(twoFactor_controller_1.twoFactorController));
router.post("/totp/setup", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.setupTotp.bind(twoFactor_controller_1.twoFactorController));
router.post("/totp/confirm", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.confirmTotp.bind(twoFactor_controller_1.twoFactorController));
router.post("/disable", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.disableTwoFactor.bind(twoFactor_controller_1.twoFactorController));
// Step 1: Default-channel authorization for adding alternate contact
router.post("/alternate/request-auth-otp", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.requestAddAlternateAuthOtp.bind(twoFactor_controller_1.twoFactorController));
router.post("/alternate/verify-auth-otp", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.verifyAddAlternateAuthOtp.bind(twoFactor_controller_1.twoFactorController));
// Alternate Email
router.post("/alternate-email/send-otp", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.sendAlternateEmailOtp.bind(twoFactor_controller_1.twoFactorController));
router.post("/alternate-email/confirm", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.confirmAlternateEmail.bind(twoFactor_controller_1.twoFactorController));
router.delete("/alternate-email", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.removeAlternateEmail.bind(twoFactor_controller_1.twoFactorController));
// Alternate Mobile
router.post("/alternate-mobile/send-otp", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.sendAlternateMobileOtp.bind(twoFactor_controller_1.twoFactorController));
router.post("/alternate-mobile/confirm", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.confirmAlternateMobile.bind(twoFactor_controller_1.twoFactorController));
router.delete("/alternate-mobile", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.removeAlternateMobile.bind(twoFactor_controller_1.twoFactorController));
// Routing Preferences
router.put("/preferences", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.updatePreferences.bind(twoFactor_controller_1.twoFactorController));
// Password Change Multi-Phase OTP
router.post("/password/request-otp", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.requestPasswordChangeOtp.bind(twoFactor_controller_1.twoFactorController));
router.post("/password/verify-otp", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.verifyPasswordChangeOtp.bind(twoFactor_controller_1.twoFactorController));
router.patch("/password/finalize", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.finalizePasswordChange.bind(twoFactor_controller_1.twoFactorController));
exports.default = router;
