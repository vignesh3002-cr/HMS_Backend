"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = exports.authorize = void 0;
const permission_service_1 = require("../modules/permission/permission.service");
const authorize = (permissionKey) => {
    return async (req, res, next) => {
        const authReq = req;
        if (!authReq.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const userRole = String(authReq.user.role ?? "").toUpperCase();
        const hasPermission = await permission_service_1.permissionService.hasPermission(userRole, permissionKey);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: `Forbidden. Required permission: ${permissionKey}`,
                required_permission: permissionKey,
            });
        }
        next();
    };
};
exports.authorize = authorize;
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        const authReq = req;
        if (!authReq.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const userRole = String(authReq.user.role ?? "").toLowerCase();
        const allowed = roles.some((r) => r.toLowerCase() === userRole);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: "Forbidden. You don't have permission.",
            });
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
