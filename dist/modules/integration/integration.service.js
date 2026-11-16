"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationService = void 0;
const integration_repository_1 = require("./integration.repository");
const repository = new integration_repository_1.IntegrationRepository();
class IntegrationService {
    async getProviders(branchId) {
        return repository.getProviders(branchId);
    }
    async getProviderByType(providerType, branchId) {
        return repository.getProviderByType(providerType, branchId);
    }
    async getProviderById(id) {
        return repository.getProviderById(id);
    }
    async createProvider(data) {
        if (data.is_default) {
            await this.unsetDefaultProvider(data.provider_type, data.branch_id);
        }
        return repository.createProvider(data);
    }
    async updateProvider(id, data) {
        if (data.is_default) {
            const provider = await repository.getProviderById(id);
            if (provider) {
                await this.unsetDefaultProvider(provider.provider_type, provider.branch_id);
            }
        }
        return repository.updateProvider(id, data);
    }
    async deleteProvider(id) {
        return repository.deleteProvider(id);
    }
    async getUserSettings(userId) {
        let settings = await repository.getUserSettings(userId);
        if (!settings) {
            settings = await repository.upsertUserSettings(userId, {});
        }
        return settings;
    }
    async updateUserSettings(userId, data, updatedBy) {
        return repository.upsertUserSettings(userId, data, updatedBy);
    }
    async getDefaultProvider(providerType) {
        return repository.getDefaultProvider(providerType);
    }
    async getProviderConfig(providerType, branchId) {
        const provider = await this.getProviderByType(providerType, branchId);
        return provider?.config;
    }
    async unsetDefaultProvider(providerType, branchId) {
        const where = {
            provider_type: providerType,
            is_default: true,
        };
        if (branchId) {
            where.branch_id = branchId;
        }
        else {
            where.branch_id = null;
        }
        await prisma_1.default.integration_provider.updateMany({
            where,
            data: { is_default: false },
        });
    }
}
exports.IntegrationService = IntegrationService;
const prisma_1 = __importDefault(require("../../config/prisma"));
