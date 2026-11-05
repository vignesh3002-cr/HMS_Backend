import { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { LOGIN_ENABLED_ROLES } from "../../permissions/roles";
import prisma from "../../config/prisma";

export type AuthRequest = Request & {
  user?: any;
  // Set by authorizeSelfOrPermission when the caller is accessing their own
  // record - lets downstream middleware (branchScope) skip branch-ambiguity
  // checks, since accessing your own data never needs branch disambiguation.
  isSelfAccess?: boolean;
};

/*
 * Shared body for authenticate / authenticateAllowQueryToken: resolve a
 * token, verify it, and enforce the same role checks either way. The two
 * exports differ only in where they're willing to find the token -- both
 * reject (401/403) on anything missing or invalid, never fall through to
 * an unauthenticated request the way the old patient-document flexAuth did.
 */
const runAuthentication = async (
  req: AuthRequest,
  res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
  allowQueryToken: boolean
) => {

  try {

    // Prefer the Authorization header over the cookie - the frontend keeps
    // the header in sync on every request, whereas a stale/expired "token"
    // cookie from an earlier session can otherwise shadow a fresh login.
    // allowQueryToken additionally accepts ?token=... for routes opened
    // directly by the browser (an <img>/<a> can't set a header) -- only the
    // document view/download routes use that variant.
    const token =
      req.headers.authorization?.split(" ")[1] ||
      req.cookies?.token ||
      (allowQueryToken && typeof req.query.token === "string" ? req.query.token : undefined);


    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }


    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    );


    req.user = decoded;

    // Check if role is allowed to login
    const userRole = String(req.user?.role ?? "").toLowerCase();
    const isAllowed = LOGIN_ENABLED_ROLES.some((r) => r.toLowerCase() === userRole);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. Your role is not authorized to access this system.",
      });
    }

    // Respect the "disable role" toggle in Role Management (role_id_config.is_active).
    // Roles with no config row (not yet seeded) are treated as active so this
    // never locks everyone out by default.
    const roleConfig = await prisma.role_id_config.findUnique({
      where: { role_type: String(req.user?.role ?? "") },
    });

    if (roleConfig && !roleConfig.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your role has been disabled by an administrator.",
      });
    }

    next();


  } catch (error) {

    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });

  }

};

export const authenticate: RequestHandler = (req, res, next) =>
  runAuthentication(req as AuthRequest, res, next, false);

/*
 * Same checks as authenticate, plus a ?token= query param fallback for
 * routes a browser opens directly (document view/download via <img src> or
 * <a href>, which can't attach an Authorization header). Unlike the old
 * patient-document flexAuth, a missing or invalid token here still gets
 * rejected -- it never silently proceeds unauthenticated.
 */
export const authenticateAllowQueryToken: RequestHandler = (req, res, next) =>
  runAuthentication(req as AuthRequest, res, next, true);