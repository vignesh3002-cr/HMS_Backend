"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const auth_repository_1 = require("./auth.repository");
const bcrypt_1 = require("../../utils/bcrypt");
const jwt_1 = require("../../utils/jwt");
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const crypto_1 = require("crypto");
const mail_1 = require("../../utils/mail");
const BRANCH_SCOPED_ROLES = [
    "BRANCH_ADMIN",
    "DOCTOR",
    "NURSE",
    "PHARMACIST",
    "STAFF",
];
class AuthService {
    authRepository = new auth_repository_1.AuthRepository();
    assertAccountUsable(user) {
        const role = user.role_type;
        const employee = user.employees;
        if (role !== "HEAD_ADMIN") {
            if (!employee) {
                throw new Error("Employee profile not found. Please contact the administrator.");
            }
            if (employee.emp_status !== true) {
                throw new Error("Account is inactive. Please contact your administrator.");
            }
            const activeMappings = user.user_branch_mapping?.filter((m) => m.status === 1);
            if (!activeMappings || activeMappings.length === 0) {
                throw new Error("No branch has been assigned to your account. Please contact the Head Admin.");
            }
        }
    }
    resolveEmail(user) {
        if (user.role_type === "PATIENT") {
            return user.patient_bio_data?.[0]?.patient_email ?? undefined;
        }
        return user.employees?.email ?? undefined;
    }
    buildAuthPayload(user) {
        const employee = user.employees;
        const primaryBranch = employee?.branch || user.branch || null;
        const primaryBranchId = employee?.branch_id || user.branch_id || null;
        const token = (0, jwt_1.generateToken)({
            username: user.username,
            role: user.role_type,
            user_id: user.user_id,
            hospital_id: primaryBranch?.hospital_id,
        });
        return {
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                role: user.role_type,
                role_type: user.role_type,
                hospital_id: primaryBranch?.hospital_id,
                branch_id: primaryBranchId,
                branch_name: primaryBranch?.branch_name || null,
                branch_area: primaryBranch?.branch_area || null,
                emp_status: employee?.emp_status ?? null,
            },
        };
    }
    async login(username, password, rememberMe) {
        const user = await this.authRepository.findUserByUsername(username);
        if (!user) {
            throw new Error("Invalid username or password");
        }
        const passwordMatched = await (0, bcrypt_1.comparePassword)(password, user.password);
        if (!passwordMatched) {
            throw new Error("Invalid username or password");
        }
        this.assertAccountUsable(user);
        // OTP flow temporarily disabled - logging in directly after password check
        // return {
        //   username: user.username,
        // };
        return this.buildAuthPayload(user);
    }
    async sendOtp(username) {
        const user = await this.authRepository.findUserByUsername(username);
        if (!user) {
            throw new Error("User not found");
        }
        this.assertAccountUsable(user);
        const email = this.resolveEmail(user);
        if (!email) {
            throw new Error("Email address not found");
        }
        const otp = (0, crypto_1.randomInt)(100000, 999999).toString();
        const otpId = await (0, idGenerator_1.generateId)(prisma_1.default, "LOGIN_OTP");
        const expiry = new Date(Date.now() + 5 * 60 * 1000);
        await prisma_1.default.login_otp.create({
            data: {
                otp_id: otpId,
                user_id: user.user_id,
                user_type: user.role_type === "PATIENT" ? "PATIENT" : "EMPLOYEE",
                otp_code: otp,
                expires_at: expiry
            }
        });
        await (0, mail_1.sendOtpEmail)(email, otp);
        return {
            message: `OTP sent to ${email.replace(/^(.{2}).*(@.*)$/, "$1***$2")}`,
        };
    }
    async verifyOtp(username, code) {
        const user = await this.authRepository.findUserByUsername(username);
        if (!user) {
            throw new Error("User not found");
        }
        // OTP verification temporarily disabled
        // const otpRecord = await prisma.login_otp.findFirst({
        //   where: {
        //     user_id: user.user_id!,
        //     is_verified: false
        //   },
        //   orderBy: {
        //     created_at: "desc"
        //   }
        // });
        // if (!otpRecord) {
        //   throw new Error("OTP not found. Please request a new one.");
        // }
        // if (otpRecord.otp_code !== code) {
        //   throw new Error("Invalid OTP");
        // }
        // if (otpRecord.expires_at < new Date()) {
        //   throw new Error("OTP has expired");
        // }
        // await prisma.login_otp.update({
        //   where: {
        //     id: otpRecord.id
        //   },
        //   data: {
        //     is_verified: true
        //   }
        // });
        return this.buildAuthPayload(user);
    }
}
exports.AuthService = AuthService;
