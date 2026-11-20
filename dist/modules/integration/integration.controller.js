"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationController = void 0;
const integration_service_1 = require("./integration.service");
const smsService_1 = require("./smsService");
const mail_1 = require("../../utils/mail");
const service = new integration_service_1.IntegrationService();
function getUserId(req) {
    return req.user?.user_id || req.user?.employee_id;
}
class IntegrationController {
    async getProviders(req, res, next) {
        try {
            const rawBranch = req.query.branch_id;
            const branchId = typeof rawBranch === "string" ? rawBranch : Array.isArray(rawBranch) ? String(rawBranch[0]) : undefined;
            const providers = await service.getProviders(branchId);
            res.json({ data: providers });
        }
        catch (err) {
            next(err);
        }
    }
    async getProviderByType(req, res, next) {
        try {
            const type = String(req.params.type);
            const rawBranch = req.query.branch_id;
            const branchId = typeof rawBranch === "string" ? rawBranch : Array.isArray(rawBranch) ? String(rawBranch[0]) : undefined;
            const provider = await service.getProviderByType(type, branchId);
            if (!provider) {
                return res.status(404).json({ message: "Provider not found" });
            }
            res.json({ data: provider });
        }
        catch (err) {
            next(err);
        }
    }
    async getProviderById(req, res, next) {
        try {
            const id = String(req.params.id);
            const provider = await service.getProviderById(id);
            if (!provider) {
                return res.status(404).json({ message: "Provider not found" });
            }
            res.json({ data: provider });
        }
        catch (err) {
            next(err);
        }
    }
    async createProvider(req, res, next) {
        try {
            const data = req.body;
            data.created_by = getUserId(req);
            const provider = await service.createProvider(data);
            res.status(201).json({ data: provider });
        }
        catch (err) {
            next(err);
        }
    }
    async updateProvider(req, res, next) {
        try {
            const id = String(req.params.id);
            const data = req.body;
            data.updated_by = getUserId(req);
            const provider = await service.updateProvider(id, data);
            if (!provider) {
                return res.status(404).json({ message: "Provider not found" });
            }
            res.json({ data: provider });
        }
        catch (err) {
            next(err);
        }
    }
    async deleteProvider(req, res, next) {
        try {
            const id = String(req.params.id);
            const deleted = await service.deleteProvider(id);
            if (!deleted) {
                return res.status(404).json({ message: "Provider not found" });
            }
            res.json({ message: "Provider deleted successfully" });
        }
        catch (err) {
            next(err);
        }
    }
    async getUserSettings(req, res, next) {
        try {
            const userId = getUserId(req);
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const settings = await service.getUserSettings(userId);
            res.json({ data: settings });
        }
        catch (err) {
            next(err);
        }
    }
    async updateUserSettings(req, res, next) {
        try {
            const userId = getUserId(req);
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const data = req.body;
            const updatedBy = getUserId(req);
            const settings = await service.updateUserSettings(userId, data, updatedBy);
            res.json({ data: settings });
        }
        catch (err) {
            next(err);
        }
    }
    async getProviderConfig(req, res, next) {
        try {
            const type = String(req.params.type);
            const rawBranch = req.query.branch_id;
            const branchId = typeof rawBranch === "string" ? rawBranch : Array.isArray(rawBranch) ? String(rawBranch[0]) : undefined;
            const config = await service.getProviderConfig(type, branchId);
            if (!config) {
                return res.status(404).json({ message: "Provider configuration not found" });
            }
            res.json({ data: config });
        }
        catch (err) {
            next(err);
        }
    }
    async sendSMSOTP(req, res, next) {
        try {
            const { deviceId, recipients, message } = req.body;
            if (!deviceId || !recipients || !message) {
                return res.status(400).json({ message: "deviceId, recipients, and message are required" });
            }
            const result = await service.sendSMSOTP(deviceId, recipients, message);
            res.json({ data: result });
        }
        catch (err) {
            next(err);
        }
    }
    async testEmail(req, res, next) {
        try {
            const config = req.body ?? {};
            const to = config.to || config.auth?.user || config.from;
            if (!to) {
                return res.status(400).json({ message: "A recipient email is required" });
            }
            await (0, mail_1.sendOtpEmailWithConfig)(config, String(to), "123456");
            res.json({ success: true, message: `Test email sent to ${to}` });
        }
        catch (err) {
            next(err);
        }
    }
    async testSms(req, res, next) {
        try {
            const { deviceId, to, recipients, message, apiKey, apiUrl } = req.body ?? {};
            let target = to || (Array.isArray(recipients) ? recipients[0] : recipients);
            if (!deviceId) {
                return res.status(400).json({ message: "deviceId is required" });
            }
            if (!target) {
                const userId = getUserId(req);
                if (userId) {
                    target = await service.getUserMobile(userId);
                }
            }
            if (!target) {
                return res.status(400).json({
                    message: "No test recipient available. Add a mobile number in Settings → Security or pass a recipient explicitly.",
                });
            }
            const result = await (0, smsService_1.sendSMS)({
                deviceId,
                recipients: [String(target)],
                message: message || "Test SMS from HMS",
                apiKey,
                apiUrl,
            });
            res.json({ success: true, message: `Test SMS sent to ${target}`, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    async testWhatsApp(_req, res) {
        res.status(501).json({ message: "WhatsApp delivery is not configured" });
    }
}
exports.IntegrationController = IntegrationController;
