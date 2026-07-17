"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const auth_repository_1 = require("./auth.repository");
const bcrypt_1 = require("../../utils/bcrypt");
const jwt_1 = require("../../utils/jwt");
class AuthService {
    authRepository = new auth_repository_1.AuthRepository();
    async login(username, password) {
        const user = await this.authRepository.findUserByUsername(username);
        if (!user) {
            throw new Error("Invalid username or password");
        }
        if (user.user_status !== 0) {
            throw new Error("Account is inactive");
        }
        const passwordMatched = await (0, bcrypt_1.comparePassword)(password, user.password);
        if (!passwordMatched) {
            throw new Error("Invalid username or password");
        }
        const token = (0, jwt_1.generateToken)({
            username: user.username,
            role: user.role_type,
            hospital_id: user.branch?.hospital_id,
        });
        return {
            token,
            user_details: {
                username: user.username,
                role: user.role_type,
                hospital_id: user.branch?.hospital_id,
            },
            branch: {
                branch_id: user.branch_id,
                branch_name: user.branch?.branch_name,
                branch_area: user.branch?.branch_area,
            }
        };
    }
}
exports.AuthService = AuthService;
