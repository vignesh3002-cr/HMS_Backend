"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const user_repository_1 = require("./user.repository");
const bcrypt_1 = require("../../../utils/bcrypt");
class UserService {
    userRepository = new user_repository_1.UserRepository();
    async createBranchAdmin(data, adminId) {
        // Check username
        const usernameExists = await this.userRepository.findByUsername(data.username);
        if (usernameExists) {
            throw new Error("Username already exists");
        }
        // Check email
        const emailExists = await this.userRepository.findByEmail(data.email);
        if (emailExists) {
            throw new Error("Email already exists");
        }
        // Check mobile
        const mobileExists = await this.userRepository.findByMobile(data.mobile);
        if (mobileExists) {
            throw new Error("Mobile number already exists");
        }
        // Get last Branch Admin
        // Hash password
        const hashedPassword = await (0, bcrypt_1.hashPassword)(data.password);
        // Save into DB
        const user = await this.userRepository.create({
            role_type: "BRANCH_ADMIN",
            parent_id: adminId,
            name: data.name,
            branch_name: data.branch_name,
            mobile: data.mobile,
            email: data.email,
            username: data.username,
            password: hashedPassword,
            status: 0
        });
        return {
            message: "Branch Admin Created Successfully",
            user: {}
        };
    }
}
exports.UserService = UserService;
