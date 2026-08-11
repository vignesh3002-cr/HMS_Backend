"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = exports.authorizeSelfOrPermission = exports.authorize = void 0;
const permission_service_1 = require("../modules/permission/permission.service");
const prisma_1 = __importDefault(require("../config/prisma"));
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
// Lets a user always read/update their OWN employee record (matched by the
// :employeeId route param) regardless of the employee.read/employee.update
// permission - e.g. a Doctor/Nurse/etc. has neither permission, but must
// still be able to open and save their own "Edit Profile" page. Anyone
// targeting a different employeeId still needs the real permission.
const authorizeSelfOrPermission = (permissionKey) => {
    return async (req, res, next) => {
        const authReq = req;
        if (!authReq.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const targetEmployeeId = req.params.employeeId;
        const own = await prisma_1.default.employees.findUnique({
            where: { user_id: authReq.user.user_id },
            select: { employee_id: true },
        });
        if (own?.employee_id && own.employee_id === targetEmployeeId) {
            authReq.isSelfAccess = true;
            return next();
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
exports.authorizeSelfOrPermission = authorizeSelfOrPermission;
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
