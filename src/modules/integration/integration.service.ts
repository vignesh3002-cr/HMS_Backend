import { IntegrationRepository } from "./integration.repository";
import {
  IntegrationProviderResponse,
  UserIntegrationSettingsResponse,
  CreateIntegrationProviderInput,
  UpdateIntegrationProviderInput,
  UpdateUserIntegrationSettingsInput,
  ProviderType,
  IntegrationProviderConfig,
} from "./integration.types";

const repository = new IntegrationRepository();

export class IntegrationService {
  async getProviders(branchId?: string): Promise<IntegrationProviderResponse[]> {
    return repository.getProviders(branchId);
  }

  async getProviderByType(
    providerType: ProviderType,
    branchId?: string
  ): Promise<IntegrationProviderResponse | null> {
    return repository.getProviderByType(providerType, branchId);
  }

  async getProviderById(id: string): Promise<IntegrationProviderResponse | null> {
    return repository.getProviderById(id);
  }

  async createProvider(
    data: CreateIntegrationProviderInput
  ): Promise<IntegrationProviderResponse> {
    if (data.is_default) {
      await this.unsetDefaultProvider(data.provider_type, data.branch_id);
    }
    return repository.createProvider(data);
  }

  async updateProvider(
    id: string,
    data: UpdateIntegrationProviderInput
  ): Promise<IntegrationProviderResponse | null> {
    if (data.is_default) {
      const provider = await repository.getProviderById(id);
      if (provider) {
        await this.unsetDefaultProvider(provider.provider_type as ProviderType, provider.branch_id);
      }
    }
    return repository.updateProvider(id, data);
  }

  async deleteProvider(id: string): Promise<boolean> {
    return repository.deleteProvider(id);
  }

  async getUserSettings(userId: string): Promise<UserIntegrationSettingsResponse | null> {
    let settings = await repository.getUserSettings(userId);
    if (!settings) {
      settings = await repository.upsertUserSettings(userId, {});
    }
    return settings;
  }

  async updateUserSettings(
    userId: string,
    data: UpdateUserIntegrationSettingsInput,
    updatedBy?: string
  ): Promise<UserIntegrationSettingsResponse> {
    return repository.upsertUserSettings(userId, data, updatedBy);
  }

  async getDefaultProvider(
    providerType: ProviderType
  ): Promise<IntegrationProviderResponse | null> {
    return repository.getDefaultProvider(providerType);
  }

  async getProviderConfig(
    providerType: ProviderType,
    branchId?: string
  ): Promise<IntegrationProviderConfig | null> {
    const provider = await this.getProviderByType(providerType, branchId);
    return provider?.config as IntegrationProviderConfig | null;
  }

  private async unsetDefaultProvider(
    providerType: ProviderType,
    branchId?: string | null
  ): Promise<void> {
    const where: any = {
      provider_type: providerType,
      is_default: true,
    };
    if (branchId) {
      where.branch_id = branchId;
    } else {
      where.branch_id = null;
    }
    await prisma.integration_provider.updateMany({
      where,
      data: { is_default: false },
    });
  }
}

import prisma from "../../config/prisma";