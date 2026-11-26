"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const userAuthInclude = {
    branch: {
        include: { hospital: true },
    },
    employees: {
        include: {
            branch: {
                include: { hospital: true },
            },
        },
    },
    patient_bio_data: true,
    user_branch_mapping: {
        where: { status: 1 },
        include: {
            branch: {
                include: { hospital: true },
            },
        },
    },
};
class AuthRepository {
    async findUserById(userId) {
        return prisma_1.default.user_table.findFirst({
            where: { user_id: userId },
        });
    }
    async findUserByUsername(username) {
        const trimmed = (username || "").trim();
        let user = await prisma_1.default.user_table.findFirst({
            where: {
                OR: [
                    {
                        username: {
                            equals: trimmed,
                            mode: "insensitive",
                        },
                    },
                    {
                        patient_bio_data: {
                            some: {
                                OR: [
                                    { patient_id: { equals: trimmed, mode: "insensitive" } },
                                    { patient_primary_mobile: { equals: trimmed } },
                                    { patient_email: { equals: trimmed, mode: "insensitive" } },
                                ],
                            },
                        },
                    },
                ],
            },
            include: userAuthInclude,
        });
        // If not found or if patient_bio_data was not populated, query patient_bio_data directly
        if (!user || (!user.patient_bio_data?.length && !user.employees)) {
            const patient = await prisma_1.default.patient_bio_data.findFirst({
                where: {
                    OR: [
                        { patient_id: { equals: trimmed, mode: "insensitive" } },
                        { patient_primary_mobile: { equals: trimmed } },
                        { patient_email: { equals: trimmed, mode: "insensitive" } },
                    ],
                },
                include: {
                    user_table: {
                        include: userAuthInclude,
                    },
                },
            });
            if (patient?.user_table) {
                const resolvedUser = patient.user_table;
                if (!resolvedUser.patient_bio_data || resolvedUser.patient_bio_data.length === 0) {
                    resolvedUser.patient_bio_data = [patient];
                }
                user = resolvedUser;
            }
        }
        return user;
    }
    async updateKpiPreferences(userId, kpiPreferences) {
        return prisma_1.default.user_table.update({
            where: { user_id: userId },
            data: { kpi_preferences: kpiPreferences },
        });
    }
    async updateKpiUsage(userId, kpiUsage) {
        return prisma_1.default.user_table.update({
            where: { user_id: userId },
            data: { kpi_usage: kpiUsage },
        });
    }
}
exports.AuthRepository = AuthRepository;
