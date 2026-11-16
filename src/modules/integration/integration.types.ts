export type ProviderType = "EMAIL" | "SMS" | "WHATSAPP";

export interface IntegrationProviderConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from?: string;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  apiUrl?: string;
  apiKey?: string;
}

export interface IntegrationProviderResponse {
  id: string;
  provider_type: ProviderType;
  provider_name: string;
  config: IntegrationProviderConfig;
  is_active: boolean;
  is_default: boolean;
  branch_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
}

export interface UserIntegrationSettingsResponse {
  id: string;
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
  email_provider_id: string | null;
  sms_provider_id: string | null;
  whatsapp_provider_id: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
}

export interface UpdateUserIntegrationSettingsInput {
  email_enabled?: boolean;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  in_app_enabled?: boolean;
  email_provider_id?: string | null;
  sms_provider_id?: string | null;
  whatsapp_provider_id?: string | null;
}

export interface CreateIntegrationProviderInput {
  provider_type: ProviderType;
  provider_name: string;
  config: IntegrationProviderConfig;
  is_active?: boolean;
  is_default?: boolean;
  branch_id?: string | null;
  created_by?: string | null;
}

export interface UpdateIntegrationProviderInput {
  provider_name?: string;
  config?: IntegrationProviderConfig;
  is_active?: boolean;
  is_default?: boolean;
  updated_by?: string | null;
}