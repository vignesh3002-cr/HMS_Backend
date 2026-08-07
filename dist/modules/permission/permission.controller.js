"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionController = void 0;
const permission_service_1 = require("./permission.service");
class PermissionController {
    async getMatrix(req, res) {
        try {
            const matrix = await permission_service_1.permissionService.getPermissionMatrix();
            return res.json({ success: true, data: matrix });
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    async grantPermission(req, res) {
        try {
            const { role_type, permission_key } = req.body;
            const userId = req.user?.user_id;
            if (!role_type || !permission_key) {
                return res.status(400).json({ success: false, message: "role_type and permission_key are required" });
            }
            await permission_service_1.permissionService.grantPermission(role_type, permission_key, userId);
            return res.json({ success: true, message: "Permission granted" });
        }
        catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }
    async revokePermission(req, res) {
        try {
            const { role_type, permission_key } = req.body;
            const userId = req.user?.user_id;
            if (!role_type || !permission_key) {
                return res.status(400).json({ success: false, message: "role_type and permission_key are required" });
            }
            await permission_service_1.permissionService.revokePermission(role_type, permission_key, userId);
            return res.json({ success: true, message: "Permission revoked" });
        }
        catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }
    async bulkUpdatePermissions(req, res) {
        try {
            const { updates } = req.body;
            const userId = req.user?.user_id;
            if (!Array.isArray(updates) || updates.length === 0) {
                return res.status(400).json({ success: false, message: "updates array is required" });
            }
            for (const u of updates) {
                if (!u.role_type || !u.permission_key || typeof u.grant !== "boolean") {
                    return res.status(400).json({ success: false, message: "Each update must have role_type, permission_key, and grant (boolean)" });
                }
            }
            await permission_service_1.permissionService.bulkUpdatePermissions(updates, userId);
            return res.json({ success: true, message: "Permissions updated" });
        }
        catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }
    async getMyPermissions(req, res) {
        try {
            const userId = req.user?.user_id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            const permissions = await permission_service_1.permissionService.getUserPermissions(userId);
            return res.json({ success: true, data: permissions });
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    async getAuditLog(req, res) {
        try {
            const { role_type, limit, offset } = req.query;
            const logs = await permission_service_1.permissionService.getAuditLog(role_type, limit ? Number(limit) : 100, offset ? Number(offset) : 0);
            return res.json({ success: true, data: logs });
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.PermissionController = PermissionController;
