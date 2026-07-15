"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class AuthRepository {
    async findUserByUsername(username) {
        return prisma_1.default.user_table.findFirst({
            where: {
                username: username,
            },
            include: {
                branch: true
            }
        });
    }
}
exports.AuthRepository = AuthRepository;
