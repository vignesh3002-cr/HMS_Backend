"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = exports.authorizeSelfPhoto = exports.authorizeNoSelf = exports.authorizeSelfOrPermission = exports.ADMIN_ROLES = exports.authorize = void 0;
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
exports.ADMIN_ROLES = ["SUPER_ADMIN", "HEAD_ADMIN", "BRANCH_ADMIN"];
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
// Same as authorize, but never lets a user modify/delete their OWN employee
// record (matched by the :employeeId route param) - admins manage everyone
// except themselves from the lists; self-management goes through the
// read-only own profile instead.
const authorizeNoSelf = (permissionKey) => {
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
            return res.status(403).json({
                success: false,
                message: "You cannot modify or delete your own profile.",
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
exports.authorizeNoSelf = authorizeNoSelf;
// Photo-only self-update: an admin (SUPER_ADMIN/HEAD_ADMIN/BRANCH_ADMIN) may
// change their OWN employee photo, but nothing else. Anyone targeting a
// different employeeId still needs the real permission.
const authorizeSelfPhoto = (permissionKey) => {
    return async (req, res, next) => {
        const authReq = req;
        if (!authReq.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const targetEmployeeId = req.params.employeeId;
        const userRole = String(authReq.user.role ?? "").toUpperCase();
        const own = await prisma_1.default.employees.findUnique({
            where: { user_id: authReq.user.user_id },
            select: { employee_id: true },
        });
        if (own?.employee_id && own.employee_id === targetEmployeeId) {
            if (!exports.ADMIN_ROLES.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: "Only admins can change their own photo.",
                });
            }
            return next();
        }
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
exports.authorizeSelfPhoto = authorizeSelfPhoto;
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
