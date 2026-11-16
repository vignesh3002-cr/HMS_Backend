"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const PROVIDER_SELECT = {
    id: true,
    provider_type: true,
    provider_name: true,
    config: true,
    is_active: true,
    is_default: true,
    branch_id: true,
    created_by: true,
    created_at: true,
    updated_at: true,
    updated_by: true,
};
const USER_SETTINGS_SELECT = {
    id: true,
    user_id: true,
    email_enabled: true,
    sms_enabled: true,
    whatsapp_enabled: true,
    in_app_enabled: true,
    email_provider_id: true,
    sms_provider_id: true,
    whatsapp_provider_id: true,
    created_at: true,
    updated_at: true,
    updated_by: true,
};
function mapProvider(p) {
    return {
        ...p,
        provider_type: p.provider_type,
    };
}
class IntegrationRepository {
    async getProviders(branchId) {
        const where = { is_active: true };
        if (branchId) {
            where.OR = [{ branch_id: branchId }, { branch_id: null }];
        }
        else {
            where.branch_id = null;
        }
        const providers = await prisma_1.default.integration_provider.findMany({
            where,
            orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
            select: PROVIDER_SELECT,
        });
        return providers.map(mapProvider);
    }
    async getProviderByType(providerType, branchId) {
        const where = { provider_type: providerType, is_active: true };
        if (branchId) {
            where.OR = [{ branch_id: branchId }, { branch_id: null }];
        }
        else {
            where.branch_id = null;
        }
        const provider = await prisma_1.default.integration_provider.findFirst({
            where,
            orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
            select: PROVIDER_SELECT,
        });
        return provider ? mapProvider(provider) : null;
    }
    async getProviderById(id) {
        const provider = await prisma_1.default.integration_provider.findUnique({
            where: { id },
            select: PROVIDER_SELECT,
        });
        return provider ? mapProvider(provider) : null;
    }
    async createProvider(data) {
        const provider = await prisma_1.default.integration_provider.create({
            data: {
                ...data,
                config: data.config,
            },
            select: PROVIDER_SELECT,
        });
        return mapProvider(provider);
    }
    async updateProvider(id, data) {
        const provider = await prisma_1.default.integration_provider.update({
            where: { id },
            data: {
                ...data,
                config: data.config,
                updated_at: new Date(),
            },
            select: PROVIDER_SELECT,
        });
        return provider ? mapProvider(provider) : null;
    }
    async deleteProvider(id) {
        const result = await prisma_1.default.integration_provider.delete({
            where: { id },
        });
        return !!result;
    }
    async getUserSettings(userId) {
        return prisma_1.default.user_integration_settings.findUnique({
            where: { user_id: userId },
            select: USER_SETTINGS_SELECT,
        });
    }
    async upsertUserSettings(userId, data, updatedBy) {
        return prisma_1.default.user_integration_settings.upsert({
            where: { user_id: userId },
            create: {
                user_id: userId,
                ...data,
                updated_by: updatedBy,
            },
            update: {
                ...data,
                updated_by: updatedBy,
                updated_at: new Date(),
            },
            select: USER_SETTINGS_SELECT,
        });
    }
    async getDefaultProvider(providerType) {
        const provider = await prisma_1.default.integration_provider.findFirst({
            where: {
                provider_type: providerType,
                is_default: true,
                is_active: true,
            },
            select: PROVIDER_SELECT,
        });
        return provider ? mapProvider(provider) : null;
    }
}
exports.IntegrationRepository = IntegrationRepository;
