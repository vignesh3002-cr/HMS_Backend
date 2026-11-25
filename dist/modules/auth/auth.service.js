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
const sms_1 = require("../../utils/sms");
const roles_1 = require("../../permissions/roles");
class AuthService {
    authRepository = new auth_repository_1.AuthRepository();
    assertAccountUsable(user) {
        const role = user.role_type;
        const hasPatientBio = Array.isArray(user.patient_bio_data) && user.patient_bio_data.length > 0;
        const isPatientRole = String(role ?? "").toUpperCase() === "PATIENT";
        const employee = user.employees;
        // A user is a patient if role_type is PATIENT, or has patient_bio_data,
        // or has no employee record (never an employee profile).
        const isPatient = isPatientRole || hasPatientBio || (!employee && !roles_1.TOP_LEVEL_ADMIN_ROLES.some((r) => r.toLowerCase() === String(role ?? "").toLowerCase()));
        if (isPatient) {
            const patient = user.patient_bio_data?.[0];
            if (patient) {
                if (patient.patient_active?.toLowerCase() === "inactive" || user.user_status === 1) {
                    throw new Error("Patient account is inactive. Please contact hospital reception.");
                }
            }
            return;
        }
        const isTopLevelAdmin = roles_1.TOP_LEVEL_ADMIN_ROLES.some((r) => r.toLowerCase() === String(role ?? "").toLowerCase());
        if (!isTopLevelAdmin) {
            if (!employee) {
                throw new Error("Employee profile not found. Please contact the administrator.");
            }
            if (employee.emp_status !== true) {
                throw new Error("Account is inactive. Please contact your administrator.");
            }
            const activeMappings = user.user_branch_mapping?.filter((m) => m.status === 1 && m.branch?.branch_status === "Active");
            if (!activeMappings || activeMappings.length === 0) {
                throw new Error("No active branch has been assigned to your account. Please contact the Head Admin.");
            }
        }
    }
    async resolveEmail(user) {
        const isTopLevelAdmin = roles_1.TOP_LEVEL_ADMIN_ROLES.some((r) => r.toLowerCase() === String(user.role_type ?? "").toLowerCase());
        const isPatient = String(user.role_type ?? "").toUpperCase() === "PATIENT" ||
            (Array.isArray(user.patient_bio_data) && user.patient_bio_data.length > 0) ||
            (!user.employees && !isTopLevelAdmin);
        if (isPatient) {
            return user.patient_bio_data?.[0]?.patient_email ?? undefined;
        }
        if (user.user_id) {
            const twoFactor = await prisma_1.default.user_two_factor.findUnique({
                where: { user_id: user.user_id },
            });
            if (twoFactor?.preferred_email_target === "SECONDARY" &&
                twoFactor.alternate_email_verified &&
                twoFactor.alternate_email) {
                return twoFactor.alternate_email;
            }
        }
        return user.employees?.email ?? undefined;
    }
    buildAuthPayload(user, rememberMe = false) {
        const hasPatientBio = Array.isArray(user.patient_bio_data) && user.patient_bio_data.length > 0;
        const isPatientRole = String(user.role_type ?? "").toUpperCase() === "PATIENT";
        const isPatient = isPatientRole || hasPatientBio || !user.employees;
        const effectiveRole = isPatient ? "PATIENT" : user.role_type || "STAFF";
        const patient = user.patient_bio_data?.[0];
        const patientName = patient
            ? [patient.patient_first_name, patient.patient_middle_name, patient.patient_last_name].filter(Boolean).join(" ")
            : user.username;
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
            : primaryMapping?.branch_id || employee?.branch_id || user.branch_id || (isPatient ? patient?.branch_id : null);
        const hospitalId = primaryBranch?.hospital_id;
        const hospitalName = primaryBranch?.hospital?.hospital_name || null;
        const token = (0, jwt_1.generateToken)({
            username: user.username,
            role: effectiveRole,
            user_id: user.user_id,
            employee_id: employee?.employee_id ?? null,
            patient_id: patient?.patient_id ?? null,
            hospital_id: hospitalId,
        }, rememberMe);
        return {
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                role: effectiveRole,
                role_type: effectiveRole,
                employee_id: employee?.employee_id ?? null,
                patient_id: patient?.patient_id ?? null,
                patient_name: isPatient ? patientName : null,
                patient_uhid: patient?.patient_id ?? null,
                patient_gender: patient?.patient_gender ?? null,
                patient_blood_group: patient?.patient_blood_group ?? null,
                patient_mobile: patient?.patient_primary_mobile ?? null,
                patient_email: patient?.patient_email ?? null,
                hospital_id: hospitalId,
                hospital_name: hospitalName,
                branch_id: primaryBranchId,
                branch_name: primaryBranch?.branch_name || null,
                branch_area: primaryBranch?.branch_area || null,
                emp_status: employee?.emp_status ?? null,
            },
        };
    }
    /**
     * Builds a login session for a user whose second factor has already been
     * verified (e.g. TOTP / recovery code in the 2FA module). Reuses the exact
     * same payload/token shape as a password login so downstream consumers
     * cannot tell the two flows apart.
     */
    async buildSessionForUsername(username, rememberMe = false) {
        const user = await this.authRepository.findUserByUsername(username);
        if (!user) {
            throw new Error("User not found");
        }
        this.assertAccountUsable(user);
        return this.buildAuthPayload(user, rememberMe);
    }
    // ---- KPI Preferences ----
    static ALLOWED_KPI_IDS = new Set([
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
    validateKpiIds(kpis) {
        return kpis.filter((id) => AuthService.ALLOWED_KPI_IDS.has(id));
    }
    async getKpiPreferences(userId) {
        const user = await this.authRepository.findUserById(userId);
        if (!user?.kpi_preferences) {
            return [];
        }
        return this.validateKpiIds(user.kpi_preferences.split(",").map((s) => s.trim()).filter(Boolean));
    }
    async saveKpiPreferences(userId, kpis) {
        const validated = this.validateKpiIds(kpis);
        const value = validated.length > 0 ? validated.join(",") : null;
        await this.authRepository.updateKpiPreferences(userId, value);
        return validated;
    }
    async getKpiUsage(userId) {
        const user = await this.authRepository.findUserById(userId);
        if (!user?.kpi_usage) {
            return {};
        }
        const usage = {};
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
    async saveKpiUsage(userId, usage) {
        const validated = {};
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
    async login(username, password, rememberMe = false, directLogin = false) {
        const user = await this.authRepository.findUserByUsername(username);
        console.log(`[AUTH] User resolved: user_id=${user?.user_id}, username=${user?.username}, role_type=${user?.role_type}, hasPatient=${user?.patient_bio_data?.length}, hasEmployee=${!!user?.employees}`);
        if (!user) {
            throw new Error("Invalid username or password");
        }
        const passwordMatched = await (0, bcrypt_1.comparePassword)(password, user.password);
        if (!passwordMatched) {
            throw new Error("Invalid username or password");
        }
        this.assertAccountUsable(user);
        // Direct Login / Cloud Test Bypass (Useful on Render free tier where SMTP/SMS is blocked)
        const isDirectLoginAllowed = process.env.ALLOW_DIRECT_LOGIN === "true" || process.env.ENABLE_OTP === "false";
        const shouldBypassOtp = isDirectLoginAllowed && (directLogin || process.env.ENABLE_OTP === "false");
        if (shouldBypassOtp) {
            const session = this.buildAuthPayload(user, rememberMe);
            return {
                username: user.username,
                requiresOtp: false,
                token: session.token,
                user: session.user,
                message: "Login successful (Direct Login enabled)",
            };
        }
        // Standard flow: Send OTP to the user's registered email/phone
        try {
            const otpResult = await this.sendOtp(user.username);
            return {
                username: user.username,
                requiresOtp: true,
                message: otpResult.message,
            };
        }
        catch (otpError) {
            if (isDirectLoginAllowed) {
                console.warn(`[Auth] OTP delivery failed (${otpError.message}). Falling back to Direct Login session because ALLOW_DIRECT_LOGIN=true.`);
                const session = this.buildAuthPayload(user, rememberMe);
                return {
                    username: user.username,
                    requiresOtp: false,
                    token: session.token,
                    user: session.user,
                    message: "Login successful (OTP service unavailable, Direct Login fallback applied)",
                };
            }
            throw otpError;
        }
    }
    async createSuperAdminUser(data) {
        const hashedPassword = await (0, bcrypt_1.hashPassword)(data.password);
        const userId = await (0, idGenerator_1.generateId)(prisma_1.default, "USER");
        const user = await prisma_1.default.user_table.create({
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
        const employeeId = await (0, idGenerator_1.generateId)(prisma_1.default, "BRANCH_ADMIN");
        await prisma_1.default.employees.create({
            data: {
                employee_id: employeeId,
                user_id: user.user_id,
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
    async sendOtp(username) {
        const user = await this.authRepository.findUserByUsername(username);
        console.log(`[AUTH] User resolved: user_id=${user?.user_id}, username=${user?.username}, role_type=${user?.role_type}, hasPatient=${user?.patient_bio_data?.length}, hasEmployee=${!!user?.employees}`);
        if (!user) {
            throw new Error("User not found");
        }
        this.assertAccountUsable(user);
        const twoFactor = await prisma_1.default.user_two_factor.findUnique({
            where: { user_id: user.user_id },
        });
        const isMobileDefault = twoFactor?.default_login_method === "PRIMARY_MOBILE" ||
            twoFactor?.default_login_method === "SECONDARY_MOBILE" ||
            twoFactor?.default_login_method === "ALT_MOBILE";
        const targetMobile = twoFactor?.default_login_method === "PRIMARY_MOBILE"
            ? (twoFactor.primary_mobile || user.employees?.mobile_no)
            : twoFactor?.alternate_mobile;
        if (isMobileDefault && targetMobile) {
            const otp = (0, crypto_1.randomInt)(100000, 999999).toString();
            const expiry = new Date(Date.now() + 5 * 60 * 1000);
            await prisma_1.default.$transaction(async (tx) => {
                const id = await (0, idGenerator_1.generateId)(tx, "LOGIN_OTP");
                await tx.login_otp.create({
                    data: {
                        otp_id: id,
                        user_id: user.user_id,
                        user_type: user.role_type === "PATIENT" ? "PATIENT" : "EMPLOYEE",
                        otp_code: otp,
                        expires_at: expiry,
                    },
                });
            });
            const message = `Your HMS verification code is ${otp}. It expires in 5 minutes.`;
            await (0, sms_1.sendSms)({ recipient: targetMobile, message });
            const compact = targetMobile.replace(/\s+/g, "");
            const masked = compact.length <= 4
                ? "*".repeat(compact.length)
                : `${"*".repeat(compact.length - 4)}${compact.slice(-4)}`;
            return {
                message: `OTP sent to ${masked}`,
            };
        }
        const email = await this.resolveEmail(user);
        if (!email) {
            throw new Error("Email address not found");
        }
        const otp = (0, crypto_1.randomInt)(100000, 999999).toString();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);
        // Generate and insert in one transaction: if the insert fails the id is
        // not consumed, keeping id_sequences aligned with the data.
        await prisma_1.default.$transaction(async (tx) => {
            const id = await (0, idGenerator_1.generateId)(tx, "LOGIN_OTP");
            await tx.login_otp.create({
                data: {
                    otp_id: id,
                    user_id: user.user_id,
                    user_type: user.role_type === "PATIENT" ? "PATIENT" : "EMPLOYEE",
                    otp_code: otp,
                    expires_at: expiry
                }
            });
        });
        await (0, mail_1.sendOtpEmail)(email, otp);
        return {
            message: `OTP sent to ${email.replace(/^(.{2}).*(@.*)$/, "$1***$2")}`,
        };
    }
    async verifyOtp(username, code, rememberMe = false) {
        const user = await this.authRepository.findUserByUsername(username);
        if (!user) {
            throw new Error("User not found");
        }
        const otpRecord = await prisma_1.default.login_otp.findFirst({
            where: {
                user_id: user.user_id,
                is_verified: false
            },
            orderBy: {
                created_at: "desc"
            }
        });
        if (!otpRecord) {
            throw new Error("OTP not found. Please request a new one.");
        }
        if (otpRecord.otp_code !== code.trim()) {
            throw new Error("Invalid OTP code");
        }
        if (otpRecord.expires_at < new Date()) {
            throw new Error("OTP has expired. Please request a new one.");
        }
        await prisma_1.default.login_otp.update({
            where: {
                id: otpRecord.id
            },
            data: {
                is_verified: true
            }
        });
        return this.buildAuthPayload(user, rememberMe);
    }
    // Self-service only - the caller can only ever change their own username,
    // never someone else's (userId comes from the authenticated JWT, not
    // request input). No cooldown period for now.
    async changeUsername(userId, newUsername) {
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
        await prisma_1.default.user_table.update({
            where: { id: user.id },
            data: { username: trimmed },
        });
        return { username: trimmed };
    }
    // Self-service only, same as changeUsername - requires the current
    // password to be re-entered, and userId always comes from the JWT.
    async changePassword(userId, oldPassword, newPassword) {
        const user = await this.authRepository.findUserById(userId);
        if (!user) {
            throw new Error("User not found");
        }
        const passwordMatched = await (0, bcrypt_1.comparePassword)(oldPassword, user.password);
        if (!passwordMatched) {
            throw new Error("Current password is incorrect");
        }
        if (!newPassword || newPassword.length < 6) {
            throw new Error("New password must be at least 6 characters");
        }
        const hashed = await (0, bcrypt_1.hashPassword)(newPassword);
        await prisma_1.default.user_table.update({
            where: { id: user.id },
            data: { password: hashed },
        });
        return { message: "Password updated successfully" };
    }
}
exports.AuthService = AuthService;
