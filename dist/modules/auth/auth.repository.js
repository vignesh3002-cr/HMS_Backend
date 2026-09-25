"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class AuthRepository {
    async findUserById(userId) {
        return prisma_1.default.user_table.findFirst({
            where: { user_id: userId },
        });
    }
    async findUserByUsername(username) {
        return prisma_1.default.user_table.findFirst({
            where: {
                username: username,
            },
            include: {
                branch: true,
                employees: {
                    include: {
                        branch: true,
                    },
                },
                patient_bio_data: true,
                user_branch_mapping: {
                    where: { status: 1 },
                    include: {
                        branch: true,
                    },
                },
            },
        });
    }
    async updateKpiPreferences(userId, kpiPreferences) {
        return prisma_1.default.user_table.update({
            where: { user_id: userId },
            data: { kpi_preferences: kpiPreferences },
        });
    }
}
exports.AuthRepository = AuthRepository;
