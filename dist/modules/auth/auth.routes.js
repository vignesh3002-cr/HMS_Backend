"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("./auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const roles_1 = require("../../permissions/roles");
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
router.post("/login", authController.login.bind(authController));
router.post("/send-otp", authController.sendOtp.bind(authController));
router.post("/verify-otp", authController.verifyOtp.bind(authController));
router.get("/me", auth_middleware_1.authenticate, (req, res) => {
    return res.json({
        success: true,
        user: req.user
    });
});
<<<<<<< HEAD
router.get("/admin", auth_middleware_1.authenticate, (0, authorize_1.authorizeRoles)(...roles_1.TOP_LEVEL_ADMIN_ROLES), (req, res) => {
=======
router.get("/admin", auth_middleware_1.authenticate, (0, authorize_1.authorize)(...roles_1.TOP_LEVEL_ADMIN_ROLES), (req, res) => {
>>>>>>> a430ca9ba6608e611b8e0041162a90cf3433d7ed
    res.json({
        success: true,
        message: "Welcome Admin"
    });
});
exports.default = router;
