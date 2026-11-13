"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationController = void 0;
const integration_service_1 = require("./integration.service");
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
}
exports.IntegrationController = IntegrationController;
