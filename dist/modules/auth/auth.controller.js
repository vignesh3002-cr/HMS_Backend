"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const authService = new auth_service_1.AuthService();
class AuthController {
    async login(req, res) {
        try {
            const { username, password, rememberMe } = req.body;
            console.log("Remember Me:", rememberMe);
            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Username and password are required"
                });
            }
            const result = await authService.login(username, password, rememberMe);
            // OTP flow temporarily disabled - issuing the session cookie directly on login
            res.cookie("token", result.token, {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                maxAge: 12 * 60 * 60 * 1000
            });
            return res.status(200).json({
                success: true,
                message: "Login successful",
                data: {
                    token: result.token,
                    user: result.user
                }
            });
            // return res.status(200).json({
            //     success: true,
            //     message: "Credentials verified",
            //     data: result
            // });
        }
        catch (error) {
            return res.status(401).json({
                success: false,
                message: error.message
            });
        }
    }
    async sendOtp(req, res) {
        try {
            const { username } = req.body;
            if (!username) {
                return res.status(400).json({
                    success: false,
                    message: "Username is required"
                });
            }
            const result = await authService.sendOtp(username);
            return res.status(200).json({
                success: true,
                message: "OTP sent",
                data: result
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async verifyOtp(req, res) {
        try {
            const { username, code, otp, rememberMe } = req.body;
            console.log("Remember Me in Verify OTP:", rememberMe);
            const otpCode = code ?? otp;
            if (!username || !otpCode) {
                return res.status(400).json({
                    success: false,
                    message: "Username and OTP code are required"
                });
            }
            const result = await authService.verifyOtp(username, otpCode);
            res.cookie("token", result.token, {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                maxAge: 12 * 60 * 60 * 1000
            });
            return res.status(200).json({
                success: true,
                message: "OTP verified successfully",
                data: {
                    user: result.user
                }
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async changeUsername(req, res) {
        try {
            const userId = req.user?.user_id;
            const { newUsername } = req.body;
            const result = await authService.changeUsername(userId, String(newUsername ?? ""));
            return res.status(200).json({
                success: true,
                message: "Username updated successfully",
                data: result
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    async changePassword(req, res) {
        try {
            const userId = req.user?.user_id;
            const { oldPassword, newPassword } = req.body;
            if (!oldPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Current password and new password are required"
                });
            }
            const result = await authService.changePassword(userId, oldPassword, newPassword);
            return res.status(200).json({
                success: true,
                message: result.message
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}
exports.AuthController = AuthController;
