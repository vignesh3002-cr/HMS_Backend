"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.branchScope = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const roles_1 = require("../permissions/roles");
const UNRESTRICTED_ROLES = roles_1.TOP_LEVEL_ADMIN_ROLES;
// Enforces server-side branch isolation for list/read endpoints.
//
// Default-deny: only roles explicitly listed in UNRESTRICTED_ROLES see all
// branches. Every other role - including ones added later and never wired
// in here - is branch-scoped by default, so a missing role entry fails
// closed instead of silently granting unrestricted access.
//
// The requested branch is never trusted from the client: for scoped roles the
// branch is resolved against the authenticated user's ACTIVE mappings only.
const branchScope = async (req, res, next) => {
    const authReq = req;
    try {
        const user = authReq.user;
        if (!user?.user_id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const role = String(user.role ?? "").toLowerCase();
        if (UNRESTRICTED_ROLES.some((r) => r.toLowerCase() === role)) {
            return next();
        }
        // BRANCH_ADMIN and STAFF_ADMIN are restricted to their assigned branch only
        const isBranchRestricted = roles_1.BRANCH_RESTRICTED_ROLES.some((r) => r.toLowerCase() === role);
        const requestedBranchId = req.query.branchId ??
            req.headers["x-branch-id"];
        const mappings = await prisma_1.default.user_branch_mapping.findMany({
            where: {
                user_id: user.user_id,
                status: 1,
            },
            select: {
                branch_id: true,
            },
        });
        const allowedBranches = mappings.map((m) => m.branch_id);
        if (allowedBranches.length === 0) {
            return res.status(403).json({
                success: false,
                message: "No branch has been assigned to your account.",
            });
        }
        // For branch-restricted roles, force single branch access
        if (isBranchRestricted) {
            if (allowedBranches.length > 1) {
                // If they have multiple branches, they must explicitly select one
                if (!requestedBranchId) {
                    return res.status(403).json({
                        success: false,
                        message: "Please select a branch first.",
                    });
                }
                if (!allowedBranches.includes(requestedBranchId)) {
                    return res.status(403).json({
                        success: false,
                        message: "Forbidden. You don't have access to this branch.",
                    });
                }
                return next();
            }
            // Single branch - auto-assign
            req.query.branchId = allowedBranches[0];
            return next();
        }
        // Other roles - existing logic
        if (requestedBranchId) {
            if (!allowedBranches.includes(requestedBranchId)) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden. You don't have access to this branch.",
                });
            }
            return next();
        }
        if (allowedBranches.length === 1) {
            req.query.branchId = allowedBranches[0];
            return next();
        }
        return res.status(403).json({
            success: false,
            message: "Please select a branch first.",
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to resolve branch scope",
        });
    }
};
exports.branchScope = branchScope;
