"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const auth_repository_1 = require("./auth.repository");
const bcrypt_1 = require("../../utils/bcrypt");
const jwt_1 = require("../../utils/jwt");
const BRANCH_SCOPED_ROLES = [
    "BRANCH_ADMIN",
    "DOCTOR",
    "NURSE",
    "PHARMACIST",
    "STAFF",
];
class AuthService {
    authRepository = new auth_repository_1.AuthRepository();
    async login(username, password) {
        const user = await this.authRepository.findUserByUsername(username);
        if (!user) {
            throw new Error("Invalid username or password");
        }
        const passwordMatched = await (0, bcrypt_1.comparePassword)(password, user.password);
        if (!passwordMatched) {
            throw new Error("Invalid username or password");
        }
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
            user_details: {
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
}
exports.AuthService = AuthService;
