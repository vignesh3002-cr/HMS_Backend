"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAllowQueryToken = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const roles_1 = require("../../permissions/roles");
const prisma_1 = __importDefault(require("../../config/prisma"));
/*
 * Shared body for authenticate / authenticateAllowQueryToken: resolve a
 * token, verify it, and enforce the same role checks either way. The two
 * exports differ only in where they're willing to find the token -- both
 * reject (401/403) on anything missing or invalid, never fall through to
 * an unauthenticated request the way the old patient-document flexAuth did.
 */
const runAuthentication = async (req, res, next, allowQueryToken) => {
    try {
        // Prefer the Authorization header over the cookie - the frontend keeps
        // the header in sync on every request, whereas a stale/expired "token"
        // cookie from an earlier session can otherwise shadow a fresh login.
        // allowQueryToken additionally accepts ?token=... for routes opened
        // directly by the browser (an <img>/<a> can't set a header) -- only the
        // document view/download routes use that variant.
        const token = req.headers.authorization?.split(" ")[1] ||
            req.cookies?.token ||
            (allowQueryToken && typeof req.query.token === "string" ? req.query.token : undefined);
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing",
            });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        // Check if role is allowed to login
        const userRole = String(req.user?.role ?? "").toLowerCase();
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
            where: { role_type: String(req.user?.role ?? "") },
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
const authenticate = (req, res, next) => runAuthentication(req, res, next, false);
exports.authenticate = authenticate;
/*
 * Same checks as authenticate, plus a ?token= query param fallback for
 * routes a browser opens directly (document view/download via <img src> or
 * <a href>, which can't attach an Authorization header). Unlike the old
 * patient-document flexAuth, a missing or invalid token here still gets
 * rejected -- it never silently proceeds unauthenticated.
 */
const authenticateAllowQueryToken = (req, res, next) => runAuthentication(req, res, next, true);
exports.authenticateAllowQueryToken = authenticateAllowQueryToken;
