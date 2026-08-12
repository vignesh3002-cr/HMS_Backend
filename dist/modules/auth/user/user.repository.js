"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const prisma_1 = __importDefault(require("../../../config/prisma"));
class UserRepository {
    async findByUsername(username) {
        return prisma_1.default.user_table.findFirst({
            where: {
                username
            }
        });
    }
    async findLastUser(role) {
        return prisma_1.default.user_table.findFirst({
            where: {
                role_type: role
            },
            orderBy: {
                id: "desc"
            }
        });
    }
    async findByMobile(mobile) {
        return prisma_1.default.employees.findFirst({
            where: {
                mobile_no: mobile
            }
        });
    }
    async create(data) {
        return prisma_1.default.user_table.create({
            data
        });
    }
    async findByEmail(email) {
        return prisma_1.default.employees.findFirst({
            where: {
                email
            }
        });
    }
}
exports.UserRepository = UserRepository;
