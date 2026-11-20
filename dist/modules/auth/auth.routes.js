"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("./auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const roles_1 = require("../../permissions/roles");
const prisma_1 = __importDefault(require("../../config/prisma"));
const twoFactor_routes_1 = __importDefault(require("./2fa/twoFactor.routes"));
const twoFactor_controller_1 = require("./2fa/twoFactor.controller");
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
// 2FA and Multi-Channel Security Subsystem
router.use("/2fa", twoFactor_routes_1.default);
router.post("/login", authController.login.bind(authController));
router.post("/send-otp", authController.sendOtp.bind(authController));
router.post("/verify-otp", authController.verifyOtp.bind(authController));
router.get("/me", auth_middleware_1.authenticate, async (req, res) => {
    const authUser = req.user;
    // employee_id isn't in the JWT payload -- the frontend needs it to
    // link "Edit Profile" to this user's own /doctor/edit/:id or
    // /staff/edit/:id record. Not present for PATIENT logins.
    const employee = await prisma_1.default.employees.findUnique({
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
});
// Sector 2: Username change disabled from user self-service
router.patch("/me/username", auth_middleware_1.authenticate, (_req, res) => {
    res.status(403).json({
        success: false,
        message: "Username cannot be changed. Please contact your system administrator.",
    });
});
// Sector 3: Password change with Old Password + OTP verification
router.post("/me/password/request-otp", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.requestPasswordChangeOtp.bind(twoFactor_controller_1.twoFactorController));
router.post("/me/password/verify-otp", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.verifyPasswordChangeOtp.bind(twoFactor_controller_1.twoFactorController));
router.patch("/me/password", auth_middleware_1.authenticate, twoFactor_controller_1.twoFactorController.finalizePasswordChange.bind(twoFactor_controller_1.twoFactorController));
router.get("/admin", auth_middleware_1.authenticate, (0, authorize_1.authorizeRoles)(...roles_1.TOP_LEVEL_ADMIN_ROLES), (req, res) => {
    res.json({
        success: true,
        message: "Welcome Admin"
    });
});
router.get("/me/kpi-preferences", auth_middleware_1.authenticate, authController.getKpiPreferences.bind(authController));
router.put("/me/kpi-preferences", auth_middleware_1.authenticate, authController.saveKpiPreferences.bind(authController));
router.get("/me/kpi-usage", auth_middleware_1.authenticate, authController.getKpiUsage.bind(authController));
router.put("/me/kpi-usage", auth_middleware_1.authenticate, authController.saveKpiUsage.bind(authController));
exports.default = router;
