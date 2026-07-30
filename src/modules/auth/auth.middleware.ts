import { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";

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

    next();


  } catch (error) {

    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });

  }

};