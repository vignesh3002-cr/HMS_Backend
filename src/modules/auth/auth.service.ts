import { AuthRepository } from "./auth.repository";
import { comparePassword, hashPassword } from "../../utils/bcrypt";
import { generateToken } from "../../utils/jwt";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { randomInt } from "crypto";
import { sendOtpEmail } from "../../utils/mail";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";
import { Prisma } from "@prisma/client";

type AuthUser = NonNullable<Awaited<ReturnType<AuthRepository["findUserByUsername"]>>>;

type UserBranchMapping = Prisma.user_branch_mappingGetPayload<{
  include: { branch: true };
}>;

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
      (m: UserBranchMapping) => m.status === 1 && m.branch?.branch_status === "Active"
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

  private buildAuthPayload(user: AuthUser, rememberMe: boolean = false) {

    const employee = user.employees;

    // user_branch_mapping (already filtered to status: 1 by findUserByUsername)
    // is the authoritative record of which branch this user is on. For
    // DOCTORs the mapping is the ONLY source of branch truth -
    // employees.branch_id/user_table.branch_id are denormalized copies that
    // can drift out of sync and are deliberately ignored. Other roles may
    // fall back to those columns when there's no active mapping at all.
    const primaryMapping = user.user_branch_mapping?.[0];
    const isDoctor = user.role_type === "DOCTOR";
    const primaryBranch = isDoctor
      ? primaryMapping?.branch ?? null
      : primaryMapping?.branch || employee?.branch || user.branch || null;
    const primaryBranchId = isDoctor
      ? primaryMapping?.branch_id ?? null
      : primaryMapping?.branch_id || employee?.branch_id || user.branch_id || null;

    const hospitalId = primaryBranch?.hospital_id;
    const hospitalName = primaryBranch?.hospital?.hospital_name || null;

    const token = generateToken({
      username: user.username,
      role: user.role_type,
      user_id: user.user_id,
      employee_id: employee?.employee_id ?? null,
      hospital_id: hospitalId,
    }, rememberMe);

    return {
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role_type,
        role_type: user.role_type,
        employee_id: employee?.employee_id ?? null,
        hospital_id: hospitalId,
        hospital_name: hospitalName,
        branch_id: primaryBranchId,
        branch_name: primaryBranch?.branch_name || null,
        branch_area: primaryBranch?.branch_area || null,
        emp_status: employee?.emp_status ?? null,
      },
    };

  }

  // ---- KPI Preferences ----

  private static readonly ALLOWED_KPI_IDS = new Set([
    "doctors",
    "patients",
    "critical-patients",
    "staff",
    "appointments",
    "prescriptions",
    "bills",
    "total-op",
    "chemo-delivered",
    "chemo-cancelled",
    "lab-visits",
    "ipd-patients",
    "beds-occupied",
  ]);

  private validateKpiIds(kpis: string[]): string[] {
    return kpis.filter((id) => AuthService.ALLOWED_KPI_IDS.has(id));
  }

  async getKpiPreferences(userId: string): Promise<string[]> {
    const user = await this.authRepository.findUserById(userId);
    if (!user?.kpi_preferences) {
      return [];
    }
    return this.validateKpiIds(user.kpi_preferences.split(",").map((s) => s.trim()).filter(Boolean));
  }

  async saveKpiPreferences(userId: string, kpis: string[]): Promise<string[]> {
    const validated = this.validateKpiIds(kpis);
    const value = validated.length > 0 ? validated.join(",") : null;
    await this.authRepository.updateKpiPreferences(userId, value);
    return validated;
  }

  async getKpiUsage(userId: string): Promise<Record<string, number>> {
    const user = await this.authRepository.findUserById(userId);
    if (!user?.kpi_usage) {
      return {};
    }
    const usage: Record<string, number> = {};
    for (const pair of user.kpi_usage.split(",")) {
      const [id, count] = pair.split(":");
      const trimmedId = id?.trim();
      const parsed = Number(count);
      if (trimmedId && AuthService.ALLOWED_KPI_IDS.has(trimmedId) && Number.isFinite(parsed) && parsed > 0) {
        usage[trimmedId] = Math.floor(parsed);
      }
    }
    return usage;
  }

  async saveKpiUsage(userId: string, usage: Record<string, number>): Promise<Record<string, number>> {
    const validated: Record<string, number> = {};
    for (const id of this.validateKpiIds(Object.keys(usage))) {
      const count = Math.floor(Number(usage[id]));
      if (Number.isFinite(count) && count > 0) {
        validated[id] = count;
      }
    }
    const value = Object.keys(validated).length > 0
      ? Object.entries(validated).map(([id, count]) => `${id}:${count}`).join(",")
      : null;
    await this.authRepository.updateKpiUsage(userId, value);
    return validated;
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

    return this.buildAuthPayload(user, rememberMe);

  }

  async createSuperAdminUser(data: {
    username: string;
    password: string;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  }) {

    const hashedPassword = await hashPassword(data.password);

    const userId = await generateId(prisma, "USER");

    const user = await prisma.user_table.create({
      data: {
        user_id: userId,
        username: data.username,
        password: hashedPassword,
        role_type: "SUPER_ADMIN",
        created_by: "SYSTEM_OWNER",
        user_status: 0,
      },
    });

    // Create employee profile for the super admin
    const employeeId = await generateId(prisma, "BRANCH_ADMIN");
    await prisma.employees.create({
      data: {
        employee_id: employeeId,
        user_id: user.user_id!,
        branch_id: null,
        first_name: data.first_name || "Super",
        middle_name: null,
        last_name: data.last_name || "Admin",
        email: data.email || null,
        mobile_no: null,
        designation: "Super Admin",
        department_id: null,
        blood_group: null,
        nationality: null,
        marital_status: null,
        aadhaar_no: null,
        pan_no: null,
        passport_no: null,
        gender: null,
        dob: null,
        permanent_address: null,
        current_address: null,
        employee_photo_URL: null,
        employee_state: null,
        employee_district: null,
        employee_area: null,
        employee_pincode: null,
        permanent_employee_state: null,
        permanent_employee_district: null,
        permanent_employee_area: null,
        permanent_employee_pincode: null,
        employee_no_experence: null,
        emergency_contact_name: null,
        emergency_contact_relationship: null,
        emergency_contact_number: null,
        joining_date: null,
        emp_status: true,
      },
    });

    return {
      user_id: user.user_id,
      username: user.username,
      role_type: user.role_type,
      employee_id: employeeId,
    };
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

    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    // Generate and insert in one transaction: if the insert fails the id is
    // not consumed, keeping id_sequences aligned with the data.
    await prisma.$transaction(async (tx) => {
      const id = await generateId(tx, "LOGIN_OTP");
      await tx.login_otp.create({
        data: {
          otp_id: id,
          user_id: user.user_id!,
          user_type: user.role_type === "PATIENT" ? "PATIENT" : "EMPLOYEE",
          otp_code: otp,
          expires_at: expiry
        }
      });
    });

    await sendOtpEmail(email, otp);

    return {
      message: `OTP sent to ${email.replace(/^(.{2}).*(@.*)$/, "$1***$2")}`,
    };

  }

  async verifyOtp(username: string, code: string, rememberMe: boolean = false) {

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

    return this.buildAuthPayload(user, rememberMe);

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