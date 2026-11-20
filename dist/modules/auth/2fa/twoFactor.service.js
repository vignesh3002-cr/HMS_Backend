"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twoFactorService = exports.TwoFactorService = void 0;
const crypto_1 = require("crypto");
const prisma_1 = __importDefault(require("../../../config/prisma"));
const bcrypt_1 = require("../../../utils/bcrypt");
const idGenerator_1 = require("../../../utils/idGenerator");
const mail_1 = require("../../../utils/mail");
const integration_service_1 = require("../../integration/integration.service");
const smsService_1 = require("../../integration/smsService");
const auth_service_1 = require("../auth.service");
const qrcode_utils_1 = require("./qrcode.utils");
const recovery_utils_1 = require("./recovery.utils");
const totp_utils_1 = require("./totp.utils");
const OTP_TTL_MS = 5 * 60 * 1000;
const integrationService = new integration_service_1.IntegrationService();
const authService = new auth_service_1.AuthService();
function isOtpChannel(value) {
    return (value === "PRIMARY_EMAIL" ||
        value === "ALT_EMAIL" ||
        value === "SMS" ||
        value === "WHATSAPP");
}
class TwoFactorService {
    // ---------------------------------------------------------------------
    // Status
    // ---------------------------------------------------------------------
    async getStatus(userId) {
        const user = await prisma_1.default.user_table.findUnique({
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
            preferredEmailTarget: record.preferred_email_target === "SECONDARY" ? "SECONDARY" : "PRIMARY",
            primaryMobile,
            maskedPrimaryMobile: this.maskPhone(primaryMobile),
            alternateMobile: record.alternate_mobile,
            maskedAlternateMobile: this.maskPhone(record.alternate_mobile),
            alternateMobileVerified: record.alternate_mobile_verified,
            preferredMobileTarget: record.preferred_mobile_target === "SECONDARY" ? "SECONDARY" : "PRIMARY",
            whatsappEnabled: record.whatsapp_enabled,
            defaultLoginMethod: record.default_login_method,
            remainingRecoveryCodes: (0, recovery_utils_1.countUnusedCodes)(record.recovery_codes),
        };
    }
    // ---------------------------------------------------------------------
    // Authenticator app (TOTP)
    // ---------------------------------------------------------------------
    async setupTotp(userId) {
        const user = await prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
            include: { employees: true },
        });
        if (!user) {
            throw new Error("User not found");
        }
        await this.getOrCreateRecord(userId);
        const secret = (0, totp_utils_1.generateBase32Secret)();
        const accountName = user.username || user.employees?.email || userId;
        const otpauthUrl = (0, totp_utils_1.generateOtpAuthUrl)("HMS", accountName, secret);
        const [qrSvg, qrDataUrl] = await Promise.all([
            (0, qrcode_utils_1.generateQrCodeSvg)(otpauthUrl),
            (0, qrcode_utils_1.generateQrCodeDataUrl)(otpauthUrl),
        ]);
        // Store the pending secret but keep 2FA disabled until the user proves
        // they can generate a valid code (confirmTotp).
        await prisma_1.default.user_two_factor.update({
            where: { user_id: userId },
            data: { totp_secret: secret, is_enabled: false },
        });
        return { secret, otpauthUrl, qrSvg, qrDataUrl };
    }
    async confirmTotp(userId, secret, code) {
        const record = await this.getOrCreateRecord(userId);
        const effectiveSecret = record.totp_secret || secret;
        if (!effectiveSecret) {
            throw new Error("Authenticator app is not configured. Please start the setup again.");
        }
        if (!(0, totp_utils_1.verifyTotpCode)(code, effectiveSecret)) {
            throw new Error("Invalid authenticator code");
        }
        const { plaintextCodes, hashedRecords } = (0, recovery_utils_1.generateRecoveryCodes)();
        await prisma_1.default.user_two_factor.update({
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
    async disableTwoFactor(userId, password) {
        const user = await prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
        });
        if (!user) {
            throw new Error("User not found");
        }
        if (!(await this.verifyPassword(password, user.password))) {
            throw new Error("Invalid password");
        }
        await this.getOrCreateRecord(userId);
        await prisma_1.default.user_two_factor.update({
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
    // Alternate email
    // ---------------------------------------------------------------------
    async sendAlternateEmailOtp(userId, alternateEmail) {
        const email = String(alternateEmail ?? "").trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("A valid alternate email address is required");
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
    async confirmAlternateEmail(userId, alternateEmail, code) {
        const email = String(alternateEmail ?? "").trim();
        if (!email) {
            throw new Error("Alternate email is required");
        }
        await this.consumeOtp(userId, "ALT_EMAIL_VERIFY", code);
        await this.getOrCreateRecord(userId);
        await prisma_1.default.user_two_factor.update({
            where: { user_id: userId },
            data: {
                alternate_email: email,
                alternate_email_verified: true,
            },
        });
        return { success: true, message: "Alternate email verified successfully" };
    }
    async removeAlternateEmail(userId) {
        await this.getOrCreateRecord(userId);
        await prisma_1.default.user_two_factor.update({
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
    async sendAlternateMobileOtp(userId, alternateMobile, viaWhatsApp = false) {
        const mobile = String(alternateMobile ?? "").trim();
        if (!mobile) {
            throw new Error("A mobile number is required");
        }
        if (viaWhatsApp) {
            throw new Error("WhatsApp verification is not configured. Please verify this number by SMS instead.");
        }
        const otp = this.generateNumericOtp();
        await this.sendSmsOtp(mobile, otp);
        await this.createOtpRecord(userId, "ALT_MOBILE_VERIFY", otp);
        return {
            success: true,
            message: `Verification code sent to ${this.maskPhone(mobile)}`,
        };
    }
    async confirmAlternateMobile(userId, alternateMobile, code) {
        const mobile = String(alternateMobile ?? "").trim();
        if (!mobile) {
            throw new Error("Mobile number is required");
        }
        await this.consumeOtp(userId, "ALT_MOBILE_VERIFY", code);
        await this.getOrCreateRecord(userId);
        await prisma_1.default.user_two_factor.update({
            where: { user_id: userId },
            data: {
                alternate_mobile: mobile,
                alternate_mobile_verified: true,
            },
        });
        return { success: true, message: "Alternate mobile number verified successfully" };
    }
    async removeAlternateMobile(userId) {
        await this.getOrCreateRecord(userId);
        await prisma_1.default.user_two_factor.update({
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
    async updatePreferences(userId, req) {
        const { preferredEmailTarget, preferredMobileTarget, whatsappEnabled } = req ?? {};
        await this.getOrCreateRecord(userId);
        await prisma_1.default.user_two_factor.update({
            where: { user_id: userId },
            data: {
                ...(preferredEmailTarget !== undefined && {
                    preferred_email_target: preferredEmailTarget,
                }),
                ...(preferredMobileTarget !== undefined && {
                    preferred_mobile_target: preferredMobileTarget,
                }),
                ...(whatsappEnabled !== undefined && { whatsapp_enabled: whatsappEnabled }),
            },
        });
        return { success: true, message: "Security preferences updated" };
    }
    // ---------------------------------------------------------------------
    // Login verification methods
    // ---------------------------------------------------------------------
    async getAvailableLoginMethods(username) {
        const user = await prisma_1.default.user_table.findFirst({
            where: { username: { equals: username, mode: "insensitive" } },
            include: { employees: true },
        });
        if (!user || !user.user_id) {
            throw new Error("User not found");
        }
        const record = await this.getOrCreateRecord(user.user_id);
        const primaryEmail = user.employees?.email ?? null;
        const primaryMobile = record.primary_mobile ?? user.employees?.mobile_no ?? null;
        const availability = await this.getChannelAvailability();
        const methods = [];
        if (primaryEmail && availability.email) {
            methods.push({
                id: "PRIMARY_EMAIL",
                label: "Primary Email",
                description: "Send a verification code to your primary email",
                destination: this.maskEmail(primaryEmail),
                icon: "Mail",
            });
        }
        if (record.alternate_email && record.alternate_email_verified && availability.email) {
            methods.push({
                id: "ALT_EMAIL",
                label: "Alternate Email",
                description: "Send a verification code to your alternate email",
                destination: this.maskEmail(record.alternate_email),
                icon: "Mail",
            });
        }
        if ((primaryMobile || record.alternate_mobile) && availability.sms) {
            methods.push({
                id: "SMS",
                label: "Mobile SMS",
                description: "Send a verification code by text message",
                destination: this.maskPhone(record.preferred_mobile_target === "SECONDARY" && record.alternate_mobile
                    ? record.alternate_mobile
                    : primaryMobile || record.alternate_mobile),
                icon: "Smartphone",
            });
        }
        if (record.totp_secret) {
            methods.push({
                id: "TOTP",
                label: "Authenticator App",
                description: "Generate a code with Google Authenticator, Microsoft Authenticator or Bitwarden",
                icon: "KeyRound",
            });
        }
        const remainingCodes = (0, recovery_utils_1.countUnusedCodes)(record.recovery_codes);
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
            preferredEmailTarget: record.preferred_email_target === "SECONDARY" ? "SECONDARY" : "PRIMARY",
            preferredMobileTarget: record.preferred_mobile_target === "SECONDARY" ? "SECONDARY" : "PRIMARY",
            methods,
        };
    }
    async sendLoginOTP(userId, channel) {
        const { destination, targetType } = await this.resolveDestination(userId, channel);
        const otp = this.generateNumericOtp();
        // Send first, persist second: a failed delivery must not leave an
        // orphaned OTP row that the user can never receive.
        await this.deliverOtp(channel, destination, otp);
        await this.createOtpRecord(userId, targetType, otp);
        return {
            success: true,
            message: `Verification code sent via ${this.channelLabel(channel)}`,
            destination: this.maskContact(destination),
        };
    }
    async resendLoginOtp(username, channel) {
        const user = await prisma_1.default.user_table.findFirst({
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
    async verifyCustomLoginFactor(username, code, method) {
        const user = await prisma_1.default.user_table.findFirst({
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
            if (!(0, totp_utils_1.verifyTotpCode)(code, record.totp_secret)) {
                throw new Error("Invalid authenticator code");
            }
        }
        else if (method === "RECOVERY") {
            const result = (0, recovery_utils_1.verifyAndConsumeRecoveryCode)(code, record.recovery_codes);
            if (!result.valid) {
                throw new Error("Invalid or already used recovery code");
            }
            await prisma_1.default.user_two_factor.update({
                where: { user_id: user.user_id },
                data: { recovery_codes: result.updatedJson },
            });
        }
        else {
            throw new Error("Unsupported verification method");
        }
        return authService.buildSessionForUsername(username);
    }
    // ---------------------------------------------------------------------
    // Password change (old password + OTP + new password)
    // ---------------------------------------------------------------------
    async requestPasswordChangeOtp(userId, oldPassword, channel) {
        const user = await prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
        });
        if (!user) {
            throw new Error("User not found");
        }
        if (!(await this.verifyPassword(oldPassword, user.password))) {
            throw new Error("Invalid current password");
        }
        const options = await this.buildChannelOptions(userId);
        if (options.length === 0) {
            throw new Error("No verification channel is configured. Add an email or mobile number in Settings → Security.");
        }
        const selected = options.find((option) => option.id === channel) ?? options[0];
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
    async verifyPasswordChangeOtp(userId, code) {
        await this.consumeOtp(userId, "PASSWORD_RESET", code);
        return { success: true, message: "Verification code confirmed" };
    }
    async finalizePasswordChange(userId, oldPassword, newPassword) {
        if (!newPassword || newPassword.length < 8) {
            throw new Error("New password must be at least 8 characters long");
        }
        const user = await prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
        });
        if (!user) {
            throw new Error("User not found");
        }
        if (!(await this.verifyPassword(oldPassword, user.password))) {
            throw new Error("Invalid current password");
        }
        const verifiedOtp = await prisma_1.default.login_otp.findFirst({
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
        await prisma_1.default.user_table.update({
            where: { user_id: userId },
            data: { password: await (0, bcrypt_1.hashPassword)(newPassword) },
        });
        return { success: true, message: "Password changed successfully" };
    }
    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------
    async getOrCreateRecord(userId) {
        const existing = await prisma_1.default.user_two_factor.findUnique({
            where: { user_id: userId },
        });
        if (existing) {
            return existing;
        }
        return prisma_1.default.user_two_factor.create({
            data: { user_id: userId },
        });
    }
    async verifyPassword(password, hashedPassword) {
        if (!password || !hashedPassword) {
            return false;
        }
        return (0, bcrypt_1.comparePassword)(password, hashedPassword);
    }
    generateNumericOtp() {
        return (0, crypto_1.randomInt)(100000, 1000000).toString();
    }
    async createOtpRecord(userId, userType, otp) {
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);
        await prisma_1.default.$transaction(async (tx) => {
            const otpId = await (0, idGenerator_1.generateId)(tx, "LOGIN_OTP");
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
    async consumeOtp(userId, userType, code) {
        const trimmed = String(code ?? "").trim();
        if (!trimmed) {
            throw new Error("Verification code is required");
        }
        const record = await prisma_1.default.login_otp.findFirst({
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
        await prisma_1.default.login_otp.update({
            where: { id: record.id },
            data: { is_verified: true },
        });
    }
    /**
     * Every channel the current user can actually receive a code on. The
     * primary/secondary preference decides which mobile/email wins, but all
     * configured channels stay available for "try another way".
     */
    async buildChannelOptions(userId) {
        const user = await prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
            include: { employees: true },
        });
        if (!user) {
            throw new Error("User not found");
        }
        const record = await this.getOrCreateRecord(userId);
        const primaryEmail = user.employees?.email ?? null;
        const primaryMobile = record.primary_mobile ?? user.employees?.mobile_no ?? null;
        const availability = await this.getChannelAvailability();
        const options = [];
        if (primaryEmail && availability.email) {
            options.push({
                id: "PRIMARY_EMAIL",
                label: "Primary Email",
                destination: primaryEmail,
            });
        }
        if (record.alternate_email && record.alternate_email_verified && availability.email) {
            options.push({
                id: "ALT_EMAIL",
                label: "Alternate Email",
                destination: record.alternate_email,
            });
        }
        const mobile = record.preferred_mobile_target === "SECONDARY" && record.alternate_mobile
            ? record.alternate_mobile
            : primaryMobile || record.alternate_mobile;
        if (mobile && availability.sms) {
            options.push({ id: "SMS", label: "Mobile SMS", destination: mobile });
        }
        return options;
    }
    /**
     * Which delivery providers are actually usable right now. Keeps us from
     * advertising a channel the user could never receive a code on.
     */
    async getChannelAvailability() {
        const [emailConfig, smsConfig] = await Promise.all([
            integrationService.getProviderConfig("EMAIL"),
            integrationService.getProviderConfig("SMS"),
        ]);
        const envEmailConfigured = Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
        return {
            email: Boolean((emailConfig?.host && emailConfig.auth?.user && emailConfig.auth?.pass) ||
                envEmailConfigured),
            sms: Boolean(smsConfig?.deviceId),
        };
    }
    async resolveDestination(userId, channel) {
        const options = await this.buildChannelOptions(userId);
        const match = options.find((option) => option.id === channel);
        if (!match) {
            throw new Error(`No destination is configured for ${this.channelLabel(channel)}`);
        }
        const targetType = channel === "PRIMARY_EMAIL"
            ? "EMAIL"
            : channel === "ALT_EMAIL"
                ? "ALT_EMAIL"
                : channel;
        return { destination: match.destination, targetType };
    }
    async deliverOtp(channel, destination, otp) {
        switch (channel) {
            case "PRIMARY_EMAIL":
            case "ALT_EMAIL":
                await this.sendEmailOtp(destination, otp);
                return;
            case "SMS":
                await this.sendSmsOtp(destination, otp);
                return;
            case "WHATSAPP":
                throw new Error("WhatsApp delivery is not configured. Please choose email or SMS.");
            default:
                throw new Error("Unsupported verification channel");
        }
    }
    async sendEmailOtp(to, otp) {
        const config = await integrationService.getProviderConfig("EMAIL");
        await (0, mail_1.sendOtpEmailWithConfig)(config, to, otp);
    }
    async sendSmsOtp(to, otp) {
        const config = await integrationService.getProviderConfig("SMS");
        const deviceId = config?.deviceId;
        if (!deviceId) {
            throw new Error("SMS is not configured. Add your TextBee device ID in Settings → Integrations.");
        }
        try {
            await (0, smsService_1.sendSMS)({
                deviceId,
                recipients: [to],
                message: `Your HMS verification code is ${otp}. It expires in 5 minutes.`,
                apiKey: config?.apiKey,
                apiUrl: config?.apiUrl,
            });
        }
        catch (err) {
            throw new Error(`Failed to send SMS: ${err.message}`);
        }
    }
    channelLabel(channel) {
        switch (channel) {
            case "PRIMARY_EMAIL":
                return "primary email";
            case "ALT_EMAIL":
                return "alternate email";
            case "SMS":
                return "mobile SMS";
            case "WHATSAPP":
                return "WhatsApp";
            default:
                return channel;
        }
    }
    maskEmail(email) {
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
    maskPhone(phone) {
        if (!phone) {
            return "";
        }
        const compact = phone.replace(/\s+/g, "");
        if (compact.length <= 4) {
            return "*".repeat(compact.length);
        }
        return `${"*".repeat(compact.length - 4)}${compact.slice(-4)}`;
    }
    maskContact(value) {
        return value.includes("@") ? this.maskEmail(value) : this.maskPhone(value);
    }
}
exports.TwoFactorService = TwoFactorService;
exports.twoFactorService = new TwoFactorService();
exports.default = exports.twoFactorService;
