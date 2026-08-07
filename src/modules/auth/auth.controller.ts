import { Request, Response } from "express";
import { AuthService } from "./auth.service";

const authService = new AuthService();

export class AuthController {

    async login(req: Request, res: Response) {

        try {

            const { username, password, rememberMe } = req.body;
            console.log("Remember Me:", rememberMe);

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Username and password are required"
                });
            }

            const result = await authService.login(
                username,
                password,
                rememberMe
            );

            // OTP flow temporarily disabled - issuing the session cookie directly on login
            res.cookie("token", result.token, {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                maxAge: 12 * 60 * 60 * 1000
            });

            return res.status(200).json({
                success: true,
                message: "Login successful",
                data: {
                    token: result.token,
                    user: result.user
                }
            });

            // return res.status(200).json({
            //     success: true,
            //     message: "Credentials verified",
            //     data: result
            // });

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

        const { username, code, otp, rememberMe } = req.body;
        console.log("Remember Me in Verify OTP:", rememberMe);
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
        res.cookie("token", result.token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 12 * 60 * 60 * 1000
        
   });

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            data: {
                user: result.user
            }
    });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message
        });

    }

}

    async changeUsername(req: Request, res: Response) {

        try {

            const userId = (req as any).user?.user_id;
            const { newUsername } = req.body;

            const result = await authService.changeUsername(userId, String(newUsername ?? ""));

            return res.status(200).json({
                success: true,
                message: "Username updated successfully",
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async changePassword(req: Request, res: Response) {

        try {

            const userId = (req as any).user?.user_id;
            const { oldPassword, newPassword } = req.body;

            if (!oldPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Current password and new password are required"
                });
            }

            const result = await authService.changePassword(userId, oldPassword, newPassword);

            return res.status(200).json({
                success: true,
                message: result.message
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}