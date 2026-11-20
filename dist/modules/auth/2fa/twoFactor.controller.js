"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twoFactorController = exports.TwoFactorController = void 0;
const twoFactor_service_1 = require("./twoFactor.service");
/**
 * Robustly extracts the authenticated user ID from JWT payload
 * (handles user_id, id, and userId variants)
 */
function getAuthUserId(req) {
    const user = req.user;
    const id = user?.user_id ?? user?.id ?? user?.userId;
    if (!id) {
        throw new Error("Unauthorized: User ID not found in session token");
    }
    return String(id);
}
class TwoFactorController {
    async getStatus(req, res) {
        try {
            const userId = getAuthUserId(req);
            const status = await twoFactor_service_1.twoFactorService.getStatus(userId);
            res.status(200).json({ success: true, data: status });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async setupTotp(req, res) {
        try {
            const userId = getAuthUserId(req);
            const result = await twoFactor_service_1.twoFactorService.setupTotp(userId);
            res.status(200).json({ success: true, data: result });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async confirmTotp(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { secret, code } = req.body;
            if (!secret || !code) {
                res.status(400).json({ success: false, message: "Secret and 6-digit code are required" });
                return;
            }
            const result = await twoFactor_service_1.twoFactorService.confirmTotp(userId, secret, code);
            res.status(200).json({ success: true, data: result });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async disableTwoFactor(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { password } = req.body;
            if (!password) {
                res.status(400).json({ success: false, message: "Password is required to disable 2FA" });
                return;
            }
            const result = await twoFactor_service_1.twoFactorService.disableTwoFactor(userId, password);
            res.status(200).json({ success: true, data: result });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async sendAlternateEmailOtp(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { alternateEmail } = req.body;
            const result = await twoFactor_service_1.twoFactorService.sendAlternateEmailOtp(userId, alternateEmail);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async confirmAlternateEmail(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { alternateEmail, code } = req.body;
            const result = await twoFactor_service_1.twoFactorService.confirmAlternateEmail(userId, alternateEmail, code);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async removeAlternateEmail(req, res) {
        try {
            const userId = getAuthUserId(req);
            const result = await twoFactor_service_1.twoFactorService.removeAlternateEmail(userId);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async sendAlternateMobileOtp(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { alternateMobile, viaWhatsApp } = req.body;
            const result = await twoFactor_service_1.twoFactorService.sendAlternateMobileOtp(userId, alternateMobile, Boolean(viaWhatsApp));
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async confirmAlternateMobile(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { alternateMobile, code } = req.body;
            const result = await twoFactor_service_1.twoFactorService.confirmAlternateMobile(userId, alternateMobile, code);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async removeAlternateMobile(req, res) {
        try {
            const userId = getAuthUserId(req);
            const result = await twoFactor_service_1.twoFactorService.removeAlternateMobile(userId);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async updatePreferences(req, res) {
        try {
            const userId = getAuthUserId(req);
            const result = await twoFactor_service_1.twoFactorService.updatePreferences(userId, req.body);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async getAvailableLoginMethods(req, res) {
        try {
            const { username } = req.body;
            if (!username) {
                res.status(400).json({ success: false, message: "Username is required" });
                return;
            }
            const data = await twoFactor_service_1.twoFactorService.getAvailableLoginMethods(username);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async resendLoginOtp(req, res) {
        try {
            const { username, channel } = req.body;
            if (!username || !channel) {
                res.status(400).json({ success: false, message: "Username and channel are required" });
                return;
            }
            const result = await twoFactor_service_1.twoFactorService.resendLoginOtp(username, channel);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async verifyCustomLoginFactor(req, res) {
        try {
            const { username, code, method } = req.body;
            if (!username || !code || !method) {
                res.status(400).json({ success: false, message: "Username, code, and method are required" });
                return;
            }
            const result = await twoFactor_service_1.twoFactorService.verifyCustomLoginFactor(username, code, method);
            res.status(200).json({ success: true, data: result });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async requestPasswordChangeOtp(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { oldPassword, channel } = req.body;
            if (!oldPassword) {
                res.status(400).json({ success: false, message: "Current password is required" });
                return;
            }
            const result = await twoFactor_service_1.twoFactorService.requestPasswordChangeOtp(userId, oldPassword, channel);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async verifyPasswordChangeOtp(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { code } = req.body;
            if (!code) {
                res.status(400).json({ success: false, message: "Verification code is required" });
                return;
            }
            const result = await twoFactor_service_1.twoFactorService.verifyPasswordChangeOtp(userId, code);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    async finalizePasswordChange(req, res) {
        try {
            const userId = getAuthUserId(req);
            const { oldPassword, newPassword } = req.body;
            if (!oldPassword || !newPassword) {
                res.status(400).json({ success: false, message: "Current and new password are required" });
                return;
            }
            const result = await twoFactor_service_1.twoFactorService.finalizePasswordChange(userId, oldPassword, newPassword);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.TwoFactorController = TwoFactorController;
exports.twoFactorController = new TwoFactorController();
