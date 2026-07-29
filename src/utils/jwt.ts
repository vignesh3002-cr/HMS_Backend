import jwt, { Secret, SignOptions } from "jsonwebtoken";

const JWT_SECRET: Secret = process.env.JWT_SECRET!;

const JWT_EXPIRES_IN: SignOptions["expiresIn"] =
  (process.env.JWT_EXPIRES_IN || "1h") as SignOptions["expiresIn"];

export const generateToken = (
 user:any,
 rememberMe:boolean=false
)=>{

 return jwt.sign(
 {
   id:user.id,
   username:user.username
 },
 process.env.JWT_SECRET!,
 {
   expiresIn: rememberMe 
      ? "12h"
      : "5m"
 }
 );

};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};