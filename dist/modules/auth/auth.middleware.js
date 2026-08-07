"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const roles_1 = require("../../permissions/roles");
const prisma_1 = __importDefault(require("../../config/prisma"));
const authenticate = async (req, res, next) => {
    const authReq = req;
    try {
        // Prefer the Authorization header over the cookie - the frontend keeps
        // the header in sync on every request, whereas a stale/expired "token"
        // cookie from an earlier session can otherwise shadow a fresh login.
        const token = authReq.headers.authorization?.split(" ")[1] ||
            authReq.cookies?.token;
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing",
            });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        authReq.user = decoded;
        // Check if role is allowed to login
        const userRole = String(authReq.user?.role ?? "").toLowerCase();
        const isAllowed = roles_1.LOGIN_ENABLED_ROLES.some((r) => r.toLowerCase() === userRole);
        if (!isAllowed) {
            return res.status(403).json({
                success: false,
                message: "Forbidden. Your role is not authorized to access this system.",
            });
        }
        // Respect the "disable role" toggle in Role Management (role_id_config.is_active).
        // Roles with no config row (not yet seeded) are treated as active so this
        // never locks everyone out by default.
        const roleConfig = await prisma_1.default.role_id_config.findUnique({
            where: { role_type: String(authReq.user?.role ?? "") },
        });
        if (roleConfig && !roleConfig.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your role has been disabled by an administrator.",
            });
        }
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
};
exports.authenticate = authenticate;
