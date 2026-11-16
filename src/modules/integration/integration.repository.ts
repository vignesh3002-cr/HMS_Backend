import prisma from "../../config/prisma";
import {
  IntegrationProviderResponse,
  UserIntegrationSettingsResponse,
  CreateIntegrationProviderInput,
  UpdateIntegrationProviderInput,
  UpdateUserIntegrationSettingsInput,
  ProviderType,
} from "./integration.types";

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

function mapProvider(p: any): IntegrationProviderResponse {
  return {
    ...p,
    provider_type: p.provider_type as ProviderType,
  };
}

export class IntegrationRepository {
  async getProviders(branchId?: string): Promise<IntegrationProviderResponse[]> {
    const where: any = { is_active: true };
    if (branchId) {
      where.OR = [{ branch_id: branchId }, { branch_id: null }];
    } else {
      where.branch_id = null;
    }
    const providers = await prisma.integration_provider.findMany({
      where,
      orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
      select: PROVIDER_SELECT,
    });
    return providers.map(mapProvider);
  }

  async getProviderByType(
    providerType: ProviderType,
    branchId?: string
  ): Promise<IntegrationProviderResponse | null> {
    const where: any = { provider_type: providerType, is_active: true };
    if (branchId) {
      where.OR = [{ branch_id: branchId }, { branch_id: null }];
    } else {
      where.branch_id = null;
    }
    const provider = await prisma.integration_provider.findFirst({
      where,
      orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
      select: PROVIDER_SELECT,
    });
    return provider ? mapProvider(provider) : null;
  }

  async getProviderById(id: string): Promise<IntegrationProviderResponse | null> {
    const provider = await prisma.integration_provider.findUnique({
      where: { id },
      select: PROVIDER_SELECT,
    });
    return provider ? mapProvider(provider) : null;
  }

  async createProvider(
    data: CreateIntegrationProviderInput
  ): Promise<IntegrationProviderResponse> {
    const provider = await prisma.integration_provider.create({
      data: {
        ...data,
        config: data.config as any,
      },
      select: PROVIDER_SELECT,
    });
    return mapProvider(provider);
  }

  async updateProvider(
    id: string,
    data: UpdateIntegrationProviderInput
  ): Promise<IntegrationProviderResponse | null> {
    const provider = await prisma.integration_provider.update({
      where: { id },
      data: {
        ...data,
        config: data.config as any,
        updated_at: new Date(),
      },
      select: PROVIDER_SELECT,
    });
    return provider ? mapProvider(provider) : null;
  }

  async deleteProvider(id: string): Promise<boolean> {
    const result = await prisma.integration_provider.delete({
      where: { id },
    });
    return !!result;
  }

  async getUserSettings(userId: string): Promise<UserIntegrationSettingsResponse | null> {
    return prisma.user_integration_settings.findUnique({
      where: { user_id: userId },
      select: USER_SETTINGS_SELECT,
    });
  }

  async upsertUserSettings(
    userId: string,
    data: UpdateUserIntegrationSettingsInput,
    updatedBy?: string
  ): Promise<UserIntegrationSettingsResponse> {
    return prisma.user_integration_settings.upsert({
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

  async getDefaultProvider(
    providerType: ProviderType
  ): Promise<IntegrationProviderResponse | null> {
    const provider = await prisma.integration_provider.findFirst({
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