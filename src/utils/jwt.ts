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
   id:user.user_id ?? user.id,
   user_id:user.user_id,
   username:user.username,
   role:user.role,
   hospital_id:user.hospital_id
 },
 process.env.JWT_SECRET!,
 {
   expiresIn: rememberMe 
      ? "12h"
      : "12h"
 }
 );

};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};