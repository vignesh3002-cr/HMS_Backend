import { Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import jwt from "jsonwebtoken";

import prisma from "../../../config/prisma";
import { comparePassword, hashPassword } from "../../../utils/bcrypt";
import { generateId } from "../../../utils/idGenerator";
import { sendOtpEmailWithConfig } from "../../../utils/mail";
import { IntegrationService } from "../../integration/integration.service";
import { getSmsGatewayHealth, sendSMS, verifySmsDelivery } from "../../integration/smsService";
import { AuthService } from "../auth.service";
import { generateQrCodeDataUrl, generateQrCodeSvg } from "./qrcode.utils";
import {
  countUnusedCodes,
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
} from "./recovery.utils";
import { generateBase32Secret, generateOtpAuthUrl, verifyTotpCode } from "./totp.utils";

export type OtpChannel =
  | "PRIMARY_EMAIL"
  | "ALT_EMAIL"
  | "PRIMARY_MOBILE"
  | "ALT_MOBILE"
  | "SMS"
  | "WHATSAPP";

export interface SecurityPreferences {
  defaultLoginMethod?:
    | "PRIMARY_EMAIL"
    | "SECONDARY_EMAIL"
    | "PRIMARY_MOBILE"
    | "SECONDARY_MOBILE"
    | "TOTP"
    | string;
  preferredEmailTarget?: "PRIMARY" | "SECONDARY";
  preferredMobileTarget?: "PRIMARY" | "SECONDARY";
  whatsappEnabled?: boolean;
}

interface ChannelOption {
  id: OtpChannel;
  label: string;
  destination: string;
}

const OTP_TTL_MS = 5 * 60 * 1000;

const integrationService = new IntegrationService();
const authService = new AuthService();

function isOtpChannel(value: unknown): value is OtpChannel {
  return (
    value === "PRIMARY_EMAIL" ||
    value === "ALT_EMAIL" ||
    value === "PRIMARY_MOBILE" ||
    value === "ALT_MOBILE" ||
    value === "SMS" ||
    value === "WHATSAPP"
  );
}

export class TwoFactorService {
  // ---------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------

  async getStatus(userId: string) {
    const user = await prisma.user_table.findUnique({
      where: { user_id: userId },
      include: { employees: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const record = await this.getOrCreateRecord(userId);
    const primaryEmail = user.employees?.email ?? null;
    const primaryMobile = record.primary_mobile ?? user.employees?.mobile_no ?? null;

    return {
      isEnabled: record.is_enabled,
      totpConfigured: Boolean(record.totp_secret),
      primaryEmail,
      maskedPrimaryEmail: this.maskEmail(primaryEmail),
      alternateEmail: record.alternate_email,
      maskedAlternateEmail: this.maskEmail(record.alternate_email),
      alternateEmailVerified: record.alternate_email_verified,
      preferredEmailTarget:
        record.preferred_email_target === "SECONDARY" ? "SECONDARY" : "PRIMARY",
      primaryMobile,
      maskedPrimaryMobile: this.maskPhone(primaryMobile),
      alternateMobile: record.alternate_mobile,
      maskedAlternateMobile: this.maskPhone(record.alternate_mobile),
      alternateMobileVerified: record.alternate_mobile_verified,
      preferredMobileTarget:
        record.preferred_mobile_target === "SECONDARY" ? "SECONDARY" : "PRIMARY",
      whatsappEnabled: record.whatsapp_enabled,
      defaultLoginMethod:
        record.default_login_method === "EMAIL"
          ? record.preferred_email_target === "SECONDARY"
            ? "SECONDARY_EMAIL"
            : "PRIMARY_EMAIL"
          : record.default_login_method === "MOBILE" || record.default_login_method === "SMS"
          ? record.preferred_mobile_target === "SECONDARY"
            ? "SECONDARY_MOBILE"
            : "PRIMARY_MOBILE"
          : record.default_login_method,
      remainingRecoveryCodes: countUnusedCodes(record.recovery_codes),
    };
  }

  // ---------------------------------------------------------------------
  // Authenticator app (TOTP)
  // ---------------------------------------------------------------------

  async setupTotp(userId: string) {
    const user = await prisma.user_table.findUnique({
      where: { user_id: userId },
      include: { employees: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    await this.getOrCreateRecord(userId);

    const secret = generateBase32Secret();
    const accountName = user.username || user.employees?.email || userId;
    const otpauthUrl = generateOtpAuthUrl("HMS", accountName, secret);

    const [qrSvg, qrDataUrl] = await Promise.all([
      generateQrCodeSvg(otpauthUrl),
      generateQrCodeDataUrl(otpauthUrl),
    ]);

    // Store the pending secret but keep 2FA disabled until the user proves
    // they can generate a valid code (confirmTotp).
    await prisma.user_two_factor.update({
      where: { user_id: userId },
      data: { totp_secret: secret, is_enabled: false },
    });

    return { secret, otpauthUrl, qrSvg, qrDataUrl };
  }

  async confirmTotp(userId: string, secret: string, code: string) {
    const record = await this.getOrCreateRecord(userId);
    const effectiveSecret = record.totp_secret || secret;

    if (!effectiveSecret) {
      throw new Error("Authenticator app is not configured. Please start the setup again.");
    }

    if (!verifyTotpCode(code, effectiveSecret)) {
      throw new Error("Invalid authenticator code");
    }

    const { plaintextCodes, hashedRecords } = generateRecoveryCodes();

    await prisma.user_two_factor.update({
      where: { user_id: userId },
      data: {
        totp_secret: effectiveSecret,
        is_enabled: true,
        recovery_codes: JSON.stringify(hashedRecords),
        default_login_method: "TOTP",
      },
    });

    return { success: true, recoveryCodes: plaintextCodes };
  }

  async disableTwoFactor(userId: string, password: string) {
    const user = await prisma.user_table.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!(await this.verifyPassword(password, user.password))) {
      throw new Error("Invalid password");
    }

    await this.getOrCreateRecord(userId);

    await prisma.user_two_factor.update({
      where: { user_id: userId },
      data: {
        is_enabled: false,
        totp_secret: null,
        recovery_codes: null,
        default_login_method: "EMAIL",
      },
    });

    return { success: true, message: "Two-factor authentication disabled" };
  }

  // ---------------------------------------------------------------------
  // Authorization for adding alternate contact
  // ---------------------------------------------------------------------

  async requestAddAlternateAuthOtp(userId: string) {
    const record = await this.getOrCreateRecord(userId);
    const options = await this.buildChannelOptions(userId);

    if (options.length === 0) {
      return {
        success: true,
        authorized: true,
        message: "No default channel configured",
        destination: "",
        defaultMethod: "",
      };
    }

    let targetChannelId: string | undefined;
    const def = record.default_login_method;
    if (def === "PRIMARY_EMAIL" && options.some((o) => o.id === "PRIMARY_EMAIL")) {
      targetChannelId = "PRIMARY_EMAIL";
    } else if (
      (def === "SECONDARY_EMAIL" || def === "ALT_EMAIL") &&
      options.some((o) => o.id === "ALT_EMAIL")
    ) {
      targetChannelId = "ALT_EMAIL";
    } else if (def === "PRIMARY_MOBILE" && options.some((o) => o.id === "PRIMARY_MOBILE")) {
      targetChannelId = "PRIMARY_MOBILE";
    } else if (
      (def === "SECONDARY_MOBILE" || def === "ALT_MOBILE") &&
      options.some((o) => o.id === "ALT_MOBILE")
    ) {
      targetChannelId = "ALT_MOBILE";
    }

    const selected = options.find((o) => o.id === targetChannelId) ?? options[0];
    const otp = this.generateNumericOtp();

    await this.deliverOtp(selected.id, selected.destination, otp);
    await this.createOtpRecord(userId, "ALT_AUTHORIZE", otp);

    return {
      success: true,
      authorized: false,
      message: `Authorization code sent to ${this.maskContact(selected.destination)}`,
      destination: this.maskContact(selected.destination),
      defaultMethod: selected.id,
    };
  }

  async verifyAddAlternateAuthOtp(userId: string, code: string) {
    await this.consumeOtp(userId, "ALT_AUTHORIZE", code);
    return { success: true, message: "Authorization confirmed. You may now verify your new alternate contact." };
  }

  // ---------------------------------------------------------------------
  // Alternate email
  // ---------------------------------------------------------------------

  async sendAlternateEmailOtp(userId: string, alternateEmail: string) {
    const email = String(alternateEmail ?? "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("A valid alternate email address is required");
    }

    const options = await this.buildChannelOptions(userId);
    if (options.length > 0) {
      const authorized = await prisma.login_otp.findFirst({
        where: {
          user_id: userId,
          user_type: "ALT_AUTHORIZE",
          is_verified: true,
          created_at: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
      });
      if (!authorized) {
        throw new Error("Please authorize this request using your default OTP method first.");
      }
    }

    const otp = this.generateNumericOtp();

    // Delivery happens before the OTP row is written: if the mail server
    // rejects the message there is nothing left behind to clean up.
    await this.sendEmailOtp(email, otp);
    await this.createOtpRecord(userId, "ALT_EMAIL_VERIFY", otp);

    return {
      success: true,
      message: `Verification code sent to ${this.maskEmail(email)}`,
    };
  }

  async confirmAlternateEmail(userId: string, alternateEmail: string, code: string) {
    const email = String(alternateEmail ?? "").trim();

    if (!email) {
      throw new Error("Alternate email is required");
    }

    await this.consumeOtp(userId, "ALT_EMAIL_VERIFY", code);
    await this.getOrCreateRecord(userId);

    await prisma.user_two_factor.update({
      where: { user_id: userId },
      data: {
        alternate_email: email,
        alternate_email_verified: true,
      },
    });

    await prisma.login_otp.deleteMany({
      where: {
        user_id: userId,
        user_type: "ALT_AUTHORIZE",
      },
    });

    return { success: true, message: "Alternate email verified successfully" };
  }

  async removeAlternateEmail(userId: string) {
    await this.getOrCreateRecord(userId);

    await prisma.user_two_factor.update({
      where: { user_id: userId },
      data: {
        alternate_email: null,
        alternate_email_verified: false,
        preferred_email_target: "PRIMARY",
      },
    });

    return { success: true, message: "Alternate email removed" };
  }

  // ---------------------------------------------------------------------
  // Alternate mobile
  // ---------------------------------------------------------------------

  async sendAlternateMobileOtp(
    userId: string,
    alternateMobile: string,
    viaWhatsApp: boolean = false
  ) {
    const mobile = String(alternateMobile ?? "").trim();

    if (!mobile) {
      throw new Error("A mobile number is required");
    }

    if (viaWhatsApp) {
      throw new Error(
        "WhatsApp verification is not configured. Please verify this number by SMS instead."
      );
    }

    const options = await this.buildChannelOptions(userId);
    if (options.length > 0) {
      const authorized = await prisma.login_otp.findFirst({
        where: {
          user_id: userId,
          user_type: "ALT_AUTHORIZE",
          is_verified: true,
          created_at: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
      });
      if (!authorized) {
        throw new Error("Please authorize this request using your default OTP method first.");
      }
    }

    const otp = this.generateNumericOtp();

    const delivery = await this.sendSmsOtp(mobile, otp);
    await this.createOtpRecord(userId, "ALT_MOBILE_VERIFY", otp);

    return {
      success: true,
      message:
        delivery === "queued"
          ? "Verification code accepted by the SMS gateway but delivery is not confirmed. If it does not arrive, check the TextBee phone (battery, permissions, SMS balance and SIM)."
          : `Verification code sent to ${this.maskPhone(mobile)}`,
      deliveryStatus: delivery,
    };
  }

  async confirmAlternateMobile(userId: string, alternateMobile: string, code: string) {
    const mobile = String(alternateMobile ?? "").trim();

    if (!mobile) {
      throw new Error("Mobile number is required");
    }

    await this.consumeOtp(userId, "ALT_MOBILE_VERIFY", code);
    await this.getOrCreateRecord(userId);

    await prisma.user_two_factor.update({
      where: { user_id: userId },
      data: {
        alternate_mobile: mobile,
        alternate_mobile_verified: true,
      },
    });

    await prisma.login_otp.deleteMany({
      where: {
        user_id: userId,
        user_type: "ALT_AUTHORIZE",
      },
    });

    return { success: true, message: "Alternate mobile number verified successfully" };
  }

  async removeAlternateMobile(userId: string) {
    await this.getOrCreateRecord(userId);

    await prisma.user_two_factor.update({
      where: { user_id: userId },
      data: {
        alternate_mobile: null,
        alternate_mobile_verified: false,
        preferred_mobile_target: "PRIMARY",
      },
    });

    return { success: true, message: "Alternate mobile number removed" };
  }

  // ---------------------------------------------------------------------
  // Routing preferences
  // ---------------------------------------------------------------------

  async updatePreferences(userId: string, req: SecurityPreferences) {
    const { defaultLoginMethod, preferredEmailTarget, preferredMobileTarget, whatsappEnabled } = req ?? {};

    await this.getOrCreateRecord(userId);

    // Derive synchronized email/mobile target flags from defaultLoginMethod if supplied
    let syncEmailTarget = preferredEmailTarget;
    let syncMobileTarget = preferredMobileTarget;
    if (defaultLoginMethod === "PRIMARY_EMAIL") syncEmailTarget = "PRIMARY";
    if (defaultLoginMethod === "SECONDARY_EMAIL" || defaultLoginMethod === "ALT_EMAIL") syncEmailTarget = "SECONDARY";
    if (defaultLoginMethod === "PRIMARY_MOBILE") syncMobileTarget = "PRIMARY";
    if (defaultLoginMethod === "SECONDARY_MOBILE" || defaultLoginMethod === "ALT_MOBILE") syncMobileTarget = "SECONDARY";

    await prisma.user_two_factor.update({
      where: { user_id: userId },
      data: {
        ...(defaultLoginMethod !== undefined && {
          default_login_method: defaultLoginMethod,
        }),
        ...(syncEmailTarget !== undefined && {
          preferred_email_target: syncEmailTarget,
        }),
        ...(syncMobileTarget !== undefined && {
          preferred_mobile_target: syncMobileTarget,
        }),
        ...(whatsappEnabled !== undefined && { whatsapp_enabled: whatsappEnabled }),
      },
    });

    return { success: true, message: "Security preferences updated successfully" };
  }

  // ---------------------------------------------------------------------
  // Login verification methods
  // ---------------------------------------------------------------------

  async getAvailableLoginMethods(username: string) {
    const user = await prisma.user_table.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      include: { employees: true },
    });

    if (!user || !user.user_id) {
      throw new Error("User not found");
    }

    const record = await this.getOrCreateRecord(user.user_id);
    const primaryEmail = user.employees?.email ?? null;
    const primaryMobile = record.primary_mobile ?? user.employees?.mobile_no ?? null;

    const methods: Array<{
      id: OtpChannel | "TOTP" | "RECOVERY";
      label: string;
      description: string;
      destination?: string;
      icon: string;
    }> = [];

    // Primary channels are always shown when a contact value exists. The
    // secondary channels are only offered once the contact has been verified;
    // an unverified value must never appear as a usable login method.
    if (primaryEmail) {
      methods.push({
        id: "PRIMARY_EMAIL",
        label: "Primary Email",
        description: "Send a verification code to your primary email",
        destination: this.maskEmail(primaryEmail),
        icon: "Mail",
      });
    }

    if (record.alternate_email && record.alternate_email_verified) {
      methods.push({
        id: "ALT_EMAIL",
        label: "Alternate Email",
        description: "Send a verification code to your alternate email",
        destination: this.maskEmail(record.alternate_email),
        icon: "Mail",
      });
    }

    if (primaryMobile) {
      methods.push({
        id: "PRIMARY_MOBILE",
        label: "Primary Mobile",
        description: "Send a verification code to your primary mobile by SMS",
        destination: this.maskPhone(primaryMobile),
        icon: "Smartphone",
      });
    }

    if (record.alternate_mobile && record.alternate_mobile_verified) {
      methods.push({
        id: "ALT_MOBILE",
        label: "Alternate Mobile",
        description: "Send a verification code to your alternate mobile by SMS",
        destination: this.maskPhone(record.alternate_mobile),
        icon: "Smartphone",
      });
    }

    if (record.totp_secret) {
      methods.push({
        id: "TOTP",
        label: "Authenticator App",
        description:
          "Generate a code with Google Authenticator, Microsoft Authenticator or Bitwarden",
        icon: "KeyRound",
      });
    }

    const remainingCodes = countUnusedCodes(record.recovery_codes);
    if (record.is_enabled && remainingCodes > 0) {
      methods.push({
        id: "RECOVERY",
        label: "Emergency Recovery Code",
        description: `Use one of your emergency backup codes (${remainingCodes} remaining)`,
        icon: "ShieldAlert",
      });
    }

    return {
      username: user.username ?? username,
      preferredEmailTarget:
        record.preferred_email_target === "SECONDARY" ? "SECONDARY" : "PRIMARY",
      preferredMobileTarget:
        record.preferred_mobile_target === "SECONDARY" ? "SECONDARY" : "PRIMARY",
      methods,
    };
  }

  async sendLoginOTP(userId: string, channel: OtpChannel) {
    const { destination, targetType } = await this.resolveDestination(userId, channel);
    const otp = this.generateNumericOtp();

    // Send first, persist second: a failed delivery must not leave an
    // orphaned OTP row that the user can never receive.
    const delivery = await this.deliverOtp(channel, destination, otp);
    await this.createOtpRecord(userId, targetType, otp);

    return {
      success: true,
      message:
        delivery === "queued"
          ? "Verification code accepted by the SMS gateway but delivery is not confirmed. If it does not arrive, check the TextBee phone (battery, permissions, SMS balance and SIM)."
          : `Verification code sent via ${this.channelLabel(channel)}`,
      destination: this.maskContact(destination),
      deliveryStatus: delivery,
    };
  }

  async resendLoginOtp(username: string, channel: OtpChannel) {
    const user = await prisma.user_table.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });

    if (!user || !user.user_id) {
      throw new Error("User not found");
    }

    if (!isOtpChannel(channel)) {
      throw new Error("Unsupported verification channel");
    }

    return this.sendLoginOTP(user.user_id, channel);
  }

  async verifyCustomLoginFactor(
    username: string,
    code: string,
    method: "TOTP" | "RECOVERY"
  ) {
    const user = await prisma.user_table.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });

    if (!user || !user.user_id) {
      throw new Error("User not found");
    }

    const record = await this.getOrCreateRecord(user.user_id);

    if (!record.is_enabled) {
      throw new Error("Two-factor authentication is not enabled for this account");
    }

    if (method === "TOTP") {
      if (!record.totp_secret) {
        throw new Error("Authenticator app is not configured");
      }
      if (!verifyTotpCode(code, record.totp_secret)) {
        throw new Error("Invalid authenticator code");
      }
    } else if (method === "RECOVERY") {
      const result = verifyAndConsumeRecoveryCode(code, record.recovery_codes);
      if (!result.valid) {
        throw new Error("Invalid or already used recovery code");
      }
      await prisma.user_two_factor.update({
        where: { user_id: user.user_id },
        data: { recovery_codes: result.updatedJson },
      });
    } else {
      throw new Error("Unsupported verification method");
    }

    return authService.buildSessionForUsername(username);
  }

  // ---------------------------------------------------------------------
  // Password change (old password + OTP + new password)
  // ---------------------------------------------------------------------

  async requestPasswordChangeOtp(
    userId: string,
    oldPassword: string,
    channel?: string
  ) {
    const user = await prisma.user_table.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!(await this.verifyPassword(oldPassword, user.password))) {
      throw new Error("Invalid current password");
    }

    const record = await this.getOrCreateRecord(userId);
    const options = await this.buildChannelOptions(userId);

    if (options.length === 0) {
      throw new Error(
        "No verification channel is configured. Add an email or mobile number in Settings → Security."
      );
    }

    // Determine target channel: explicit channel > user's configured default > first available option
    let targetChannelId = channel;
    if (!targetChannelId) {
      const def = record.default_login_method;
      if (def === "PRIMARY_EMAIL" && options.some((o) => o.id === "PRIMARY_EMAIL")) {
        targetChannelId = "PRIMARY_EMAIL";
      } else if (
        (def === "SECONDARY_EMAIL" || def === "ALT_EMAIL") &&
        options.some((o) => o.id === "ALT_EMAIL")
      ) {
        targetChannelId = "ALT_EMAIL";
      } else if (def === "PRIMARY_MOBILE" && options.some((o) => o.id === "PRIMARY_MOBILE")) {
        targetChannelId = "PRIMARY_MOBILE";
      } else if (
        (def === "SECONDARY_MOBILE" || def === "ALT_MOBILE") &&
        options.some((o) => o.id === "ALT_MOBILE")
      ) {
        targetChannelId = "ALT_MOBILE";
      } else if (def === "EMAIL") {
        targetChannelId =
          record.preferred_email_target === "SECONDARY" &&
          options.some((o) => o.id === "ALT_EMAIL")
            ? "ALT_EMAIL"
            : "PRIMARY_EMAIL";
      }
    }

    const selected =
      options.find((option) => option.id === targetChannelId) ?? options[0];

    const otp = this.generateNumericOtp();

    await this.deliverOtp(selected.id, selected.destination, otp);
    await this.createOtpRecord(userId, "PASSWORD_RESET", otp);

    return {
      success: true,
      message: `Verification code sent to ${this.maskContact(selected.destination)}`,
      destination: this.maskContact(selected.destination),
      currentChannel: selected.id,
      availableChannels: options.map((option) => ({
        id: option.id,
        label: option.label,
        destination: this.maskContact(option.destination),
      })),
    };
  }

  async verifyPasswordChangeOtp(userId: string, code: string) {
    await this.consumeOtp(userId, "PASSWORD_RESET", code);

    return { success: true, message: "Verification code confirmed" };
  }

  async finalizePasswordChange(
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long");
    }

    const user = await prisma.user_table.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!(await this.verifyPassword(oldPassword, user.password))) {
      throw new Error("Invalid current password");
    }

    const verifiedOtp = await prisma.login_otp.findFirst({
      where: {
        user_id: userId,
        user_type: "PASSWORD_RESET",
        is_verified: true,
      },
      orderBy: { created_at: "desc" },
    });

    if (!verifiedOtp) {
      throw new Error("Please verify the OTP before changing your password");
    }

    await prisma.user_table.update({
      where: { user_id: userId },
      data: { password: await hashPassword(newPassword) },
    });

    return { success: true, message: "Password changed successfully" };
  }

  // ---------------------------------------------------------------------
  // Forgot Password (Unauthenticated: Username -> Default OTP -> Reset)
  // ---------------------------------------------------------------------

  async requestForgotPasswordOtp(username: string) {
    const trimmed = String(username ?? "").trim();
    if (!trimmed) {
      throw new Error("Username is required");
    }

    const user = await prisma.user_table.findFirst({
      where: { username: { equals: trimmed, mode: "insensitive" } },
    });

    if (!user || !user.user_id) {
      throw new Error("User not found");
    }

    const record = await this.getOrCreateRecord(user.user_id);
    const options = await this.buildChannelOptions(user.user_id);

    if (options.length === 0) {
      throw new Error(
        "No verification channel is configured for this account. Please contact your system administrator."
      );
    }

    let targetChannelId: string | undefined;
    const def = record.default_login_method;
    if (def === "PRIMARY_EMAIL" && options.some((o) => o.id === "PRIMARY_EMAIL")) {
      targetChannelId = "PRIMARY_EMAIL";
    } else if (
      (def === "SECONDARY_EMAIL" || def === "ALT_EMAIL") &&
      options.some((o) => o.id === "ALT_EMAIL")
    ) {
      targetChannelId = "ALT_EMAIL";
    } else if (def === "PRIMARY_MOBILE" && options.some((o) => o.id === "PRIMARY_MOBILE")) {
      targetChannelId = "PRIMARY_MOBILE";
    } else if (
      (def === "SECONDARY_MOBILE" || def === "ALT_MOBILE") &&
      options.some((o) => o.id === "ALT_MOBILE")
    ) {
      targetChannelId = "ALT_MOBILE";
    }

    const selected = options.find((o) => o.id === targetChannelId) ?? options[0];
    const otp = this.generateNumericOtp();

    await this.deliverOtp(selected.id, selected.destination, otp);
    await this.createOtpRecord(user.user_id, "FORGOT_PASSWORD", otp);

    return {
      success: true,
      message: `Verification code sent to ${this.maskContact(selected.destination)}`,
      destination: this.maskContact(selected.destination),
      defaultMethod: selected.id,
    };
  }

  async verifyForgotPasswordOtp(username: string, code: string) {
    const trimmedUser = String(username ?? "").trim();
    if (!trimmedUser) {
      throw new Error("Username is required");
    }

    const user = await prisma.user_table.findFirst({
      where: { username: { equals: trimmedUser, mode: "insensitive" } },
    });

    if (!user || !user.user_id) {
      throw new Error("User not found");
    }

    await this.consumeOtp(user.user_id, "FORGOT_PASSWORD", code);

    const secret = process.env.JWT_SECRET || "Dbsol_HMS@2026";
    const resetToken = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        purpose: "FORGOT_PASSWORD",
      },
      secret,
      { expiresIn: "10m" }
    );

    return {
      success: true,
      message: "Verification code confirmed",
      resetToken,
    };
  }

  async finalizeForgotPassword(username: string, resetToken: string, newPassword: string) {
    const trimmedUser = String(username ?? "").trim();
    if (!trimmedUser) {
      throw new Error("Username is required");
    }
    if (!resetToken) {
      throw new Error("Reset token is required");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long");
    }

    const user = await prisma.user_table.findFirst({
      where: { username: { equals: trimmedUser, mode: "insensitive" } },
    });

    if (!user || !user.user_id) {
      throw new Error("User not found");
    }

    const secret = process.env.JWT_SECRET || "Dbsol_HMS@2026";
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, secret);
    } catch {
      throw new Error("Invalid or expired password reset session. Please request a new verification code.");
    }

    if (decoded?.purpose !== "FORGOT_PASSWORD" || decoded?.userId !== user.user_id) {
      throw new Error("Invalid reset session");
    }

    const verifiedOtp = await prisma.login_otp.findFirst({
      where: {
        user_id: user.user_id,
        user_type: "FORGOT_PASSWORD",
        is_verified: true,
      },
      orderBy: { created_at: "desc" },
    });

    if (!verifiedOtp) {
      throw new Error("Please verify the OTP before setting a new password");
    }

    await prisma.user_table.update({
      where: { user_id: user.user_id },
      data: { password: await hashPassword(newPassword) },
    });

    await prisma.login_otp.deleteMany({
      where: {
        user_id: user.user_id,
        user_type: "FORGOT_PASSWORD",
      },
    });

    return {
      success: true,
      message: "Password has been reset successfully. Please log in with your new password.",
    };
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private async getOrCreateRecord(userId: string) {
    const user = await prisma.user_table.findUnique({
      where: { user_id: userId },
      include: { employees: true },
    });
    const employeeMobile = user?.employees?.mobile_no ?? null;

    const existing = await prisma.user_two_factor.findUnique({
      where: { user_id: userId },
    });

    if (existing) {
      if (!existing.primary_mobile && employeeMobile) {
        return prisma.user_two_factor.update({
          where: { user_id: userId },
          data: { primary_mobile: employeeMobile },
        });
      }
      return existing;
    }

    return prisma.user_two_factor.create({
      data: {
        user_id: userId,
        primary_mobile: employeeMobile,
        default_login_method: "PRIMARY_EMAIL",
      },
    });
  }

  private async verifyPassword(
    password: string,
    hashedPassword: string | null
  ): Promise<boolean> {
    if (!password || !hashedPassword) {
      return false;
    }

    return comparePassword(password, hashedPassword);
  }

  private generateNumericOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private async createOtpRecord(userId: string, userType: string, otp: string) {
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const otpId = await generateId(tx, "LOGIN_OTP");
      await tx.login_otp.create({
        data: {
          otp_id: otpId,
          user_id: userId,
          user_type: userType,
          otp_code: otp,
          expires_at: expiresAt,
        },
      });
    });
  }

  private async consumeOtp(userId: string, userType: string, code: string) {
    const trimmed = String(code ?? "").trim();

    if (!trimmed) {
      throw new Error("Verification code is required");
    }

    const record = await prisma.login_otp.findFirst({
      where: {
        user_id: userId,
        user_type: userType,
        is_verified: false,
      },
      orderBy: { created_at: "desc" },
    });

    if (!record) {
      throw new Error("No verification code found. Please request a new one.");
    }

    if (record.otp_code !== trimmed) {
      throw new Error("Invalid verification code");
    }

    if (record.expires_at.getTime() < Date.now()) {
      throw new Error("Verification code has expired. Please request a new one.");
    }

    await prisma.login_otp.update({
      where: { id: record.id },
      data: { is_verified: true },
    });
  }

  /**
   * Every channel the current user can actually receive a code on. Unverified
   * secondary contacts are excluded so a "try another way" pick can never
   * silently fall back to a contact the user has not confirmed.
   */
  private async buildChannelOptions(userId: string): Promise<ChannelOption[]> {
    const user = await prisma.user_table.findUnique({
      where: { user_id: userId },
      include: { employees: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const record = await this.getOrCreateRecord(userId);
    const primaryEmail = user.employees?.email ?? null;
    const primaryMobile = record.primary_mobile ?? user.employees?.mobile_no ?? null;

    const options: ChannelOption[] = [];

    if (primaryEmail) {
      options.push({
        id: "PRIMARY_EMAIL",
        label: "Primary Email",
        destination: primaryEmail,
      });
    }

    if (record.alternate_email && record.alternate_email_verified) {
      options.push({
        id: "ALT_EMAIL",
        label: "Alternate Email",
        destination: record.alternate_email,
      });
    }

    if (primaryMobile) {
      options.push({
        id: "PRIMARY_MOBILE",
        label: "Primary Mobile",
        destination: primaryMobile,
      });
    }

    if (record.alternate_mobile && record.alternate_mobile_verified) {
      options.push({
        id: "ALT_MOBILE",
        label: "Alternate Mobile",
        destination: record.alternate_mobile,
      });
    }

    return options;
  }

  private async resolveDestination(userId: string, channel: OtpChannel) {
    const user = await prisma.user_table.findUnique({
      where: { user_id: userId },
      include: { employees: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const record = await this.getOrCreateRecord(userId);
    const primaryEmail = user.employees?.email ?? null;
    const primaryMobile = record.primary_mobile ?? user.employees?.mobile_no ?? null;

    // "preferred" is the backward-compatible SMS/WhatsApp target: the verified
    // secondary number only wins when it is both chosen and confirmed.
    const preferredMobile =
      record.preferred_mobile_target === "SECONDARY" &&
      record.alternate_mobile &&
      record.alternate_mobile_verified
        ? record.alternate_mobile
        : primaryMobile;

    switch (channel) {
      case "PRIMARY_EMAIL":
        if (!primaryEmail) {
          throw new Error("No primary email is configured for this account");
        }
        return { destination: primaryEmail, targetType: "EMAIL" };

      case "ALT_EMAIL":
        if (!record.alternate_email) {
          throw new Error("No alternate email is configured for this account");
        }
        if (!record.alternate_email_verified) {
          throw new Error("Your alternate email is not verified yet");
        }
        return { destination: record.alternate_email, targetType: "ALT_EMAIL" };

      case "PRIMARY_MOBILE":
        if (!primaryMobile) {
          throw new Error("No primary mobile number is configured for this account");
        }
        return { destination: primaryMobile, targetType: "SMS" };

      case "ALT_MOBILE":
        if (!record.alternate_mobile) {
          throw new Error("No alternate mobile number is configured for this account");
        }
        if (!record.alternate_mobile_verified) {
          throw new Error("Your alternate mobile number is not verified yet");
        }
        return { destination: record.alternate_mobile, targetType: "SMS" };

      case "SMS":
        if (!preferredMobile) {
          throw new Error("No mobile number is configured for this account");
        }
        return { destination: preferredMobile, targetType: "SMS" };

      case "WHATSAPP":
        if (!preferredMobile) {
          throw new Error("No mobile number is configured for this account");
        }
        return { destination: preferredMobile, targetType: "WHATSAPP" };

      default:
        throw new Error("Unsupported verification channel");
    }
  }

  private async deliverOtp(
    channel: OtpChannel,
    destination: string,
    otp: string
  ): Promise<"sent" | "queued"> {
    switch (channel) {
      case "PRIMARY_EMAIL":
      case "ALT_EMAIL":
        await this.sendEmailOtp(destination, otp);
        return "sent";
      case "PRIMARY_MOBILE":
      case "ALT_MOBILE":
      case "SMS":
        return this.sendSmsOtp(destination, otp);
      case "WHATSAPP":
        throw new Error(
          "WhatsApp delivery is not configured. Please choose email or SMS."
        );
      default:
        throw new Error("Unsupported verification channel");
    }
  }

  private async sendEmailOtp(to: string, otp: string) {
    const config = await integrationService.getProviderConfig("EMAIL");
    await sendOtpEmailWithConfig(config, to, otp);
  }

  private async sendSmsOtp(to: string, otp: string): Promise<"sent" | "queued"> {
    const config = await integrationService.getProviderConfig("SMS");
    const deviceId = config?.deviceId;

    if (!deviceId) {
      throw new Error(
        "SMS is not configured. Add your TextBee device ID in Settings → Integrations."
      );
    }

    // TEMP (testing only): stop reporting a false "sent" when the TextBee
    // phone is known to be failing. Remove with the helpers in smsService.ts.
    const health = await getSmsGatewayHealth({
      deviceId,
      apiKey: config?.apiKey,
      apiUrl: config?.apiUrl,
    });

    if (!health.healthy) {
      throw new Error(
        `SMS gateway is not delivering messages: ${health.reason}. Check the TextBee phone (battery, app permissions, SMS balance and SIM) and try again.`
      );
    }

    const message = `Your HMS verification code is ${otp}. It expires in 5 minutes.`;

    try {
      await sendSMS({
        deviceId,
        recipients: [to],
        message,
        apiKey: config?.apiKey,
        apiUrl: config?.apiUrl,
        simSlotIndex: 0,
      });

      // TEMP (testing only): catch immediate device failures so the UI does
      // not show success for a message the phone already rejected.
      const confirmation = await verifySmsDelivery({
        deviceId,
        recipients: [to],
        message,
        apiKey: config?.apiKey,
        apiUrl: config?.apiUrl,
      });

      if (health.recentFailure && confirmation !== "delivered") {
        return "queued";
      }

      return "sent";
    } catch (err) {
      throw new Error(`Failed to send SMS: ${(err as Error).message}`);
    }
  }

  private channelLabel(channel: OtpChannel): string {
    switch (channel) {
      case "PRIMARY_EMAIL":
        return "primary email";
      case "ALT_EMAIL":
        return "alternate email";
      case "PRIMARY_MOBILE":
        return "primary mobile";
      case "ALT_MOBILE":
        return "alternate mobile";
      case "SMS":
        return "mobile SMS";
      case "WHATSAPP":
        return "WhatsApp";
      default:
        return channel;
    }
  }

  private maskEmail(email: string | null | undefined): string {
    if (!email) {
      return "";
    }

    const [local, domain] = email.split("@");
    if (!domain) {
      return email;
    }

    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
  }

  private maskPhone(phone: string | null | undefined): string {
    if (!phone) {
      return "";
    }

    const compact = phone.replace(/\s+/g, "");
    if (compact.length <= 4) {
      return "*".repeat(compact.length);
    }

    return `${"*".repeat(compact.length - 4)}${compact.slice(-4)}`;
  }

  private maskContact(value: string): string {
    return value.includes("@") ? this.maskEmail(value) : this.maskPhone(value);
  }
}

export const twoFactorService = new TwoFactorService();
export default twoFactorService;
