import { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { LOGIN_ENABLED_ROLES } from "../../permissions/roles";

export type AuthRequest = Request & {
  user?: any;
};

export const authenticate: RequestHandler = (req, res, next) => {

  const authReq = req as AuthRequest;

  try {

    // Prefer the Authorization header over the cookie - the frontend keeps
    // the header in sync on every request, whereas a stale/expired "token"
    // cookie from an earlier session can otherwise shadow a fresh login.
    const token =
      authReq.headers.authorization?.split(" ")[1] ||
      authReq.cookies?.token;


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


    authReq.user = decoded;

    // Check if role is allowed to login
    const userRole = String(authReq.user?.role ?? "").toLowerCase();
    const isAllowed = LOGIN_ENABLED_ROLES.some((r) => r.toLowerCase() === userRole);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. Your role is not authorized to access this system.",
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