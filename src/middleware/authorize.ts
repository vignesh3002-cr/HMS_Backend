import { RequestHandler } from "express";
import { AuthRequest } from "../modules/auth/auth.middleware";
import { permissionService } from "../modules/permission/permission.service";

export const authorize = (permissionKey: string): RequestHandler => {
  return async (req, res, next) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userRole = String(authReq.user.role ?? "").toUpperCase();

    const hasPermission = await permissionService.hasPermission(userRole, permissionKey);

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

export const authorizeRoles = (...roles: string[]): RequestHandler => {
  return (req, res, next) => {
    const authReq = req as AuthRequest;

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