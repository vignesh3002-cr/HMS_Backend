import { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";

export type AuthRequest = Request & {
  user?: any;
};

export const authenticate: RequestHandler = (req, res, next) => {

  const authReq = req as AuthRequest;

  try {

    const token =
      authReq.cookies?.token ||
      authReq.headers.authorization?.split(" ")[1];


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