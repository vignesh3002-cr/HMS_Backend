"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("./auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
router.post("/login", authController.login.bind(authController));
router.get("/me", auth_middleware_1.authenticate, (req, res) => {
    return res.json({
        success: true,
        user: req.user
    });
});
router.get("/admin", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ADMIN"), (req, res) => {
    res.json({
        success: true,
        message: "Welcome Admin"
    });
});
exports.default = router;
