import { RequestHandler } from "express";
import { AuthRequest } from "../modules/auth/auth.middleware";
import { permissionService } from "../modules/permission/permission.service";
import prisma from "../config/prisma";

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

export const ADMIN_ROLES = ["SUPER_ADMIN", "HEAD_ADMIN", "BRANCH_ADMIN"];

// Lets a user always read/update their OWN employee record (matched by the
// :employeeId route param) regardless of the employee.read/employee.update
// permission - e.g. a Doctor/Nurse/etc. has neither permission, but must
// still be able to open and save their own "Edit Profile" page. Anyone
// targeting a different employeeId still needs the real permission.
export const authorizeSelfOrPermission = (permissionKey: string): RequestHandler => {
  return async (req, res, next) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const targetEmployeeId = req.params.employeeId;

    const own = await prisma.employees.findUnique({
      where: { user_id: authReq.user.user_id },
      select: { employee_id: true },
    });

    if (own?.employee_id && own.employee_id === targetEmployeeId) {
      authReq.isSelfAccess = true;
      return next();
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

// Same as authorize, but never lets a user modify/delete their OWN employee
// record (matched by the :employeeId route param) - admins manage everyone
// except themselves from the lists; self-management goes through the
// read-only own profile instead.
export const authorizeNoSelf = (permissionKey: string): RequestHandler => {
  return async (req, res, next) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const targetEmployeeId = req.params.employeeId;

    const own = await prisma.employees.findUnique({
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

// Photo-only self-update: an admin (SUPER_ADMIN/HEAD_ADMIN/BRANCH_ADMIN) may
// change their OWN employee photo, but nothing else. Anyone targeting a
// different employeeId still needs the real permission.
export const authorizeSelfPhoto = (permissionKey: string): RequestHandler => {
  return async (req, res, next) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const targetEmployeeId = req.params.employeeId;
    const userRole = String(authReq.user.role ?? "").toUpperCase();

    const own = await prisma.employees.findUnique({
      where: { user_id: authReq.user.user_id },
      select: { employee_id: true },
    });

    if (own?.employee_id && own.employee_id === targetEmployeeId) {
      if (!ADMIN_ROLES.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "Only admins can change their own photo.",
        });
      }
      return next();
    }

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