import { Request, Response } from "express";
import { AuthService } from "./auth.service";

const authService = new AuthService();

export class AuthController {

    async login(req: Request, res: Response) {

        try {

            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Username and password are required"
                });
            }

            const result = await authService.login(
                username,
                password
            );

            return res.status(200).json({
                success: true,
                message: "Credentials verified",
                data: result
            });

        } catch (error: any) {

            return res.status(401).json({
                success: false,
                message: error.message
            });

        }

    }

    async sendOtp(req: Request, res: Response) {

        try {

            const { username } = req.body;

            if (!username) {
                return res.status(400).json({
                    success: false,
                    message: "Username is required"
                });
            }

            const result = await authService.sendOtp(username);

            return res.status(200).json({
                success: true,
                message: "OTP sent",
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async verifyOtp(req: Request, res: Response) {

    try {

        const { username, code, otp } = req.body;
        const otpCode = code ?? otp;

        if (!username || !otpCode) {
            return res.status(400).json({
                success: false,
                message: "Username and OTP code are required"
            });
        }

        const result = await authService.verifyOtp(
            username,
            otpCode
        );

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            data: result
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message
        });

    }

}

}