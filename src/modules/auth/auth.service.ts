import { AuthRepository } from "./auth.repository";
import { comparePassword, hashPassword } from "../../utils/bcrypt";
import { generateToken } from "../../utils/jwt";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { randomInt } from "crypto";
import { sendOtpEmail } from "../../utils/mail";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";

type AuthUser = NonNullable<Awaited<ReturnType<AuthRepository["findUserByUsername"]>>>;

export class AuthService {

  private authRepository = new AuthRepository();

  private assertAccountUsable(user: AuthUser) {

    const role = user.role_type;
    const employee = user.employees;

    const isTopLevelAdmin = TOP_LEVEL_ADMIN_ROLES.some(
      (r) => r.toLowerCase() === String(role ?? "").toLowerCase()
    );

    if (!isTopLevelAdmin) {

      if (!employee) {
        throw new Error("Employee profile not found. Please contact the administrator.");
      }

      if (employee.emp_status !== true) {
        throw new Error("Account is inactive. Please contact your administrator.");
      }

const activeMappings = user.user_branch_mapping?.filter(
      (m) => m.status === 1 && m.branch?.branch_status === "Active"
    );

      if (!activeMappings || activeMappings.length === 0) {
        throw new Error("No active branch has been assigned to your account. Please contact the Head Admin.");
      }

    }

  }

  private resolveEmail(user: AuthUser): string | undefined {

    if (user.role_type === "PATIENT") {
      return (user as any).patient_bio_data?.[0]?.patient_email ?? undefined;
    }

    return user.employees?.email ?? undefined;

  }

  private buildAuthPayload(user: AuthUser) {

    const employee = user.employees;

    // user_branch_mapping (already filtered to status: 1 by findUserByUsername)
    // is the authoritative record of which branch this user is on -
    // employees.branch_id/user_table.branch_id are denormalized copies that
    // can drift out of sync with it, so prefer the real mapping first and
    // only fall back to those columns when there's no active mapping at all.
    const primaryMapping = user.user_branch_mapping?.[0];
    const primaryBranch = primaryMapping?.branch || employee?.branch || user.branch || null;
    const primaryBranchId = primaryMapping?.branch_id || employee?.branch_id || user.branch_id || null;

    const token = generateToken({
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

  async login(username: string, password: string, rememberMe: boolean) {

    const user =
      await this.authRepository.findUserByUsername(username);

    if (!user) {
      throw new Error("Invalid username or password");
    }

    const passwordMatched =
      await comparePassword(password, user.password!);

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

  async sendOtp(username: string) {

    const user =
      await this.authRepository.findUserByUsername(username);

    if (!user) {
      throw new Error("User not found");
    }

    this.assertAccountUsable(user);

    const email = this.resolveEmail(user);

    if (!email) {
      throw new Error("Email address not found");
    }

    const otp = randomInt(100000, 999999).toString();

    const otpId = await generateId(prisma, "LOGIN_OTP");

    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.login_otp.create({
      data: {
        otp_id: otpId,
        user_id: user.user_id!,
        user_type: user.role_type === "PATIENT" ? "PATIENT" : "EMPLOYEE",
        otp_code: otp,
        expires_at: expiry
      }
    });

    await sendOtpEmail(email, otp);

    return {
      message: `OTP sent to ${email.replace(/^(.{2}).*(@.*)$/, "$1***$2")}`,
    };

  }

  async verifyOtp(username: string, code: string) {

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

  // Self-service only - the caller can only ever change their own username,
  // never someone else's (userId comes from the authenticated JWT, not
  // request input). No cooldown period for now.
  async changeUsername(userId: string, newUsername: string) {

    const trimmed = newUsername.trim();

    if (!trimmed) {
      throw new Error("New username is required");
    }

    const existing = await this.authRepository.findUserByUsername(trimmed);

    if (existing && existing.user_id !== userId) {
      throw new Error("Username already exists");
    }

    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    await prisma.user_table.update({
      where: { id: user.id },
      data: { username: trimmed },
    });

    return { username: trimmed };

  }

  // Self-service only, same as changeUsername - requires the current
  // password to be re-entered, and userId always comes from the JWT.
  async changePassword(userId: string, oldPassword: string, newPassword: string) {

    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const passwordMatched = await comparePassword(oldPassword, user.password!);

    if (!passwordMatched) {
      throw new Error("Current password is incorrect");
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters");
    }

    const hashed = await hashPassword(newPassword);

    await prisma.user_table.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return { message: "Password updated successfully" };

  }

}