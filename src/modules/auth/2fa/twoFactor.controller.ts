import { Request, Response } from "express";
import { twoFactorService } from "./twoFactor.service";

/**
 * Robustly extracts the authenticated user ID from JWT payload
 * (handles user_id, id, and userId variants)
 */
function getAuthUserId(req: Request): string {
  const user = (req as any).user;
  const id = user?.user_id ?? user?.id ?? user?.userId;
  if (!id) {
    throw new Error("Unauthorized: User ID not found in session token");
  }
  return String(id);
}

export class TwoFactorController {
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const status = await twoFactorService.getStatus(userId);
      res.status(200).json({ success: true, data: status });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async setupTotp(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const result = await twoFactorService.setupTotp(userId);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async confirmTotp(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { secret, code } = req.body;
      if (!secret || !code) {
        res.status(400).json({ success: false, message: "Secret and 6-digit code are required" });
        return;
      }
      const result = await twoFactorService.confirmTotp(userId, secret, code);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async disableTwoFactor(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { password } = req.body;
      if (!password) {
        res.status(400).json({ success: false, message: "Password is required to disable 2FA" });
        return;
      }
      const result = await twoFactorService.disableTwoFactor(userId, password);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async sendAlternateEmailOtp(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { alternateEmail } = req.body;
      const result = await twoFactorService.sendAlternateEmailOtp(userId, alternateEmail);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async confirmAlternateEmail(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { alternateEmail, code } = req.body;
      const result = await twoFactorService.confirmAlternateEmail(userId, alternateEmail, code);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async removeAlternateEmail(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const result = await twoFactorService.removeAlternateEmail(userId);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async sendAlternateMobileOtp(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { alternateMobile, viaWhatsApp } = req.body;
      const result = await twoFactorService.sendAlternateMobileOtp(userId, alternateMobile, Boolean(viaWhatsApp));
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async confirmAlternateMobile(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { alternateMobile, code } = req.body;
      const result = await twoFactorService.confirmAlternateMobile(userId, alternateMobile, code);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async removeAlternateMobile(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const result = await twoFactorService.removeAlternateMobile(userId);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const result = await twoFactorService.updatePreferences(userId, req.body);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async getAvailableLoginMethods(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.body;
      if (!username) {
        res.status(400).json({ success: false, message: "Username is required" });
        return;
      }
      const data = await twoFactorService.getAvailableLoginMethods(username);
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async resendLoginOtp(req: Request, res: Response): Promise<void> {
    try {
      const { username, channel } = req.body;
      if (!username || !channel) {
        res.status(400).json({ success: false, message: "Username and channel are required" });
        return;
      }
      const result = await twoFactorService.resendLoginOtp(username, channel);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async verifyCustomLoginFactor(req: Request, res: Response): Promise<void> {
    try {
      const { username, code, method } = req.body;
      if (!username || !code || !method) {
        res.status(400).json({ success: false, message: "Username, code, and method are required" });
        return;
      }
      const result = await twoFactorService.verifyCustomLoginFactor(username, code, method);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async requestPasswordChangeOtp(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { oldPassword, channel } = req.body;
      if (!oldPassword) {
        res.status(400).json({ success: false, message: "Current password is required" });
        return;
      }
      const result = await twoFactorService.requestPasswordChangeOtp(userId, oldPassword, channel);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async verifyPasswordChangeOtp(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: "Verification code is required" });
        return;
      }
      const result = await twoFactorService.verifyPasswordChangeOtp(userId, code);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async finalizePasswordChange(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        res.status(400).json({ success: false, message: "Current and new password are required" });
        return;
      }
      const result = await twoFactorService.finalizePasswordChange(userId, oldPassword, newPassword);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async requestAddAlternateAuthOtp(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const result = await twoFactorService.requestAddAlternateAuthOtp(userId);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async verifyAddAlternateAuthOtp(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: "Authorization code is required" });
        return;
      }
      const result = await twoFactorService.verifyAddAlternateAuthOtp(userId, code);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async requestForgotPasswordOtp(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.body;
      if (!username) {
        res.status(400).json({ success: false, message: "Username is required" });
        return;
      }
      const result = await twoFactorService.requestForgotPasswordOtp(username);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async verifyForgotPasswordOtp(req: Request, res: Response): Promise<void> {
    try {
      const { username, code } = req.body;
      if (!username || !code) {
        res.status(400).json({ success: false, message: "Username and verification code are required" });
        return;
      }
      const result = await twoFactorService.verifyForgotPasswordOtp(username, code);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async finalizeForgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { username, resetToken, newPassword } = req.body;
      if (!username || !resetToken || !newPassword) {
        res.status(400).json({ success: false, message: "Username, reset token, and new password are required" });
        return;
      }
      const result = await twoFactorService.finalizeForgotPassword(username, resetToken, newPassword);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

export const twoFactorController = new TwoFactorController();
