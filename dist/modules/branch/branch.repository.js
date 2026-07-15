"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class BranchRepository {
    async findBranchCode(branchCode) {
        return prisma_1.default.branch.findFirst({
            where: {
                branch_code: branchCode
            }
        });
    }
    async findUsername(username) {
        return prisma_1.default.user_table.findFirst({
            where: {
                username
            }
        });
    }
    async findEmail(email) {
        return prisma_1.default.employees.findFirst({
            where: {
                email
            }
        });
    }
    async findMobile(mobile) {
        return prisma_1.default.employees.findFirst({
            where: {
                mobile_no: mobile
            }
        });
    }
    async getAllBranches() {
        return await prisma_1.default.branch.findMany({
            orderBy: {
                id: "desc"
            },
            include: {
                hospital: true
            }
        });
    }
}
exports.BranchRepository = BranchRepository;
