import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { authorize } from "../../middleware/authorize";
import { SYSTEM_OWNER } from "../../permissions/roles";

const authService = new AuthService();

export class AuthController {

    async login(req: Request, res: Response) {

        try {

            const { username, password, rememberMe, directLogin } = req.body;
            console.log("Remember Me:", rememberMe, "Direct Login:", directLogin);

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Username and password are required"
                });
            }

            const result = await authService.login(
                username,
                password,
                rememberMe,
                Boolean(directLogin)
            );

            if (!result.requiresOtp && result.token) {
                res.cookie("token", result.token, {
                    httpOnly: true,
                    secure: false,
                    sameSite: "lax",
                    maxAge: rememberMe ? 12 * 60 * 60 * 1000 : 5 * 60 * 1000
                });

                return res.status(200).json({
                    success: true,
                    message: result.message || "Login successful",
                    data: {
                        username: result.username,
                        requiresOtp: false,
                        token: result.token,
                        user: result.user
                    }
                });
            }

            return res.status(200).json({
                success: true,
                message: result.message || "Credentials verified. OTP sent to your email.",
                data: {
                    username: result.username,
                    requiresOtp: true
                }
            });

        } catch (error: any) {

            return res.status(401).json({
                success: false,
                message: error.message
            });

        }

    }

    // SYSTEM_OWNER only: create a SUPER_ADMIN user
    async createSuperAdmin(req: Request, res: Response) {
        try {
            const authReq = req as any;
            const callerRole = String(authReq.user?.role ?? "").toUpperCase();
            if (callerRole !== SYSTEM_OWNER) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden. Only System Owner can create Super Admin."
                });
            }

            const { username, password, email, first_name, last_name } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Username and password are required"
                });
            }

            // Check if user already exists
            const existing = await authService["authRepository"].findUserByUsername(username);
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "Username already exists"
                });
            }

            const user = await authService.createSuperAdminUser({
                username,
                password,
                email: email || null,
                first_name: first_name || null,
                last_name: last_name || null,
            });

            return res.status(201).json({
                success: true,
                message: "Super Admin created successfully",
                data: user
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message || "Failed to create Super Admin"
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
            otpCode,
            rememberMe
        );
        res.cookie("token", result.token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: rememberMe ? 12 * 60 * 60 * 1000 : 5 * 60 * 1000

   });

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            data: {
                token: result.token,
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

    async getKpiPreferences(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.user_id || (req as any).user?.id || (req as any).user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "User not authenticated",
                });
            }
            const kpis = await authService.getKpiPreferences(userId);
            return res.status(200).json({
                success: true,
                data: { kpis },
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    async saveKpiPreferences(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.user_id || (req as any).user?.id || (req as any).user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "User not authenticated",
                });
            }
            const { kpis } = req.body;
            if (!Array.isArray(kpis)) {
                return res.status(400).json({
                    success: false,
                    message: "kpis must be an array",
                });
            }
            const saved = await authService.saveKpiPreferences(userId, kpis);
            return res.status(200).json({
                success: true,
                data: { kpis: saved },
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getKpiUsage(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.user_id || (req as any).user?.id || (req as any).user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "User not authenticated",
                });
            }
            const usage = await authService.getKpiUsage(userId);
            return res.status(200).json({
                success: true,
                data: { usage },
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    async saveKpiUsage(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.user_id || (req as any).user?.id || (req as any).user?.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "User not authenticated",
                });
            }
            const { usage } = req.body;
            if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
                return res.status(400).json({
                    success: false,
                    message: "usage must be an object of kpiId:count pairs",
                });
            }
            const saved = await authService.saveKpiUsage(userId, usage);
            return res.status(200).json({
                success: true,
                data: { usage: saved },
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

}