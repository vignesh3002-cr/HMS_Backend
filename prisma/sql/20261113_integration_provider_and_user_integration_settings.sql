-- Integration Provider Configuration & User Integration Settings.
--
-- Creates integration_provider and user_integration_settings directly via
-- raw SQL (no Prisma Migrate). Mirrors the Prisma schema models:
--   - integration_provider
--   - user_integration_settings

BEGIN;

CREATE TABLE IF NOT EXISTS public.integration_provider (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type   VARCHAR(50) NOT NULL,
    provider_name   VARCHAR(100) NOT NULL,
    config          JSONB NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    branch_id       VARCHAR(100),
    created_by      VARCHAR(100),
    created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by      VARCHAR(100),

    CONSTRAINT uq_integration_provider_type_branch
        UNIQUE (provider_type, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_provider_branch_id
    ON public.integration_provider (branch_id);

CREATE INDEX IF NOT EXISTS idx_integration_provider_provider_type
    ON public.integration_provider (provider_type);

CREATE TABLE IF NOT EXISTS public.user_integration_settings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            VARCHAR(100) NOT NULL,
    email_enabled      BOOLEAN NOT NULL DEFAULT false,
    sms_enabled        BOOLEAN NOT NULL DEFAULT false,
    whatsapp_enabled   BOOLEAN NOT NULL DEFAULT false,
    in_app_enabled     BOOLEAN NOT NULL DEFAULT true,
    email_provider_id  UUID,
    sms_provider_id    UUID,
    whatsapp_provider_id UUID,
    created_at         TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by         VARCHAR(100),

    CONSTRAINT uq_user_integration_settings_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_integration_settings_user_id
    ON public.user_integration_settings (user_id);

COMMIT;
