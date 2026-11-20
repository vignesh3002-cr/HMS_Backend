"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpEmailWithConfig = exports.sendMail = exports.sendOtpEmail = void 0;
const nodemailer = __importStar(require("nodemailer"));
let transporter = null;
const isSmtpConfigured = () => Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: Number(process.env.MAIL_PORT) || 587,
            secure: Number(process.env.MAIL_PORT) === 465,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });
        transporter.verify((error, success) => {
            if (error) {
                console.error("SMTP Verify Error:", error);
            }
            else {
                console.log("SMTP Server is ready");
            }
        });
    }
    return transporter;
};
const otpHtml = (otp) => `
      <h2>Hospital Management System</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP is valid for 5 minutes.</p>
    `;
const sendOtpEmail = async (to, otp) => {
    if (!isSmtpConfigured()) {
        console.warn(`[dev] SMTP not configured (set MAIL_HOST/MAIL_USER/MAIL_PASS) - OTP for ${to}: ${otp}`);
        return;
    }
    await getTransporter().sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to,
        subject: "Your Login OTP",
        html: otpHtml(otp),
    });
};
exports.sendOtpEmail = sendOtpEmail;
/**
 * Sends an arbitrary email using the MAIL_* environment SMTP settings.
 * Throws (instead of silently logging) when SMTP is not configured or the
 * send fails, so callers can block dependent workflows as needed.
 */
const sendMail = async (options) => {
    if (!isSmtpConfigured()) {
        throw new Error("Email is not configured. Set MAIL_HOST/MAIL_USER/MAIL_PASS or add an EMAIL provider in Settings → Integrations.");
    }
    return getTransporter().sendMail({
        from: options.from || process.env.MAIL_FROM || process.env.MAIL_USER,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    });
};
exports.sendMail = sendMail;
/**
 * Sends an OTP using the SMTP settings stored in the Settings -> Integration
 * EMAIL provider. Falls back to the MAIL_* environment variables when no
 * provider is configured, and throws (instead of quietly logging) when
 * neither is available so callers can surface a real failure to the user.
 */
const sendOtpEmailWithConfig = async (config, to, otp) => {
    if (config?.host && config.auth?.user && config.auth?.pass) {
        const transport = nodemailer.createTransport({
            host: config.host,
            port: config.port ?? 587,
            secure: config.secure ?? config.port === 465,
            auth: {
                user: config.auth.user,
                pass: config.auth.pass,
            },
        });
        await transport.sendMail({
            from: config.from || config.auth.user,
            to,
            subject: "Your Login OTP",
            html: otpHtml(otp),
        });
        return;
    }
    if (!isSmtpConfigured()) {
        throw new Error("Email is not configured. Add an EMAIL provider in Settings → Integrations or set MAIL_HOST/MAIL_USER/MAIL_PASS.");
    }
    await (0, exports.sendOtpEmail)(to, otp);
};
exports.sendOtpEmailWithConfig = sendOtpEmailWithConfig;
