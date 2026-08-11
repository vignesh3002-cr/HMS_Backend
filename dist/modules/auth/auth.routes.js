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
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
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
router.patch("/me/username", auth_middleware_1.authenticate, authController.changeUsername.bind(authController));
router.patch("/me/password", auth_middleware_1.authenticate, authController.changePassword.bind(authController));
router.get("/admin", auth_middleware_1.authenticate, (0, authorize_1.authorizeRoles)(...roles_1.TOP_LEVEL_ADMIN_ROLES), (req, res) => {
    res.json({
        success: true,
        message: "Welcome Admin"
    });
});
exports.default = router;
