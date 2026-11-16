import { body, param, query } from "express-validator";

export const createIntegrationProviderValidation = [
  body("provider_type")
    .isIn(["EMAIL", "SMS", "WHATSAPP"])
    .withMessage("Provider type must be EMAIL, SMS, or WHATSAPP"),
  body("provider_name").isString().trim().notEmpty().withMessage("Provider name is required"),
  body("config").isObject().withMessage("Config must be an object"),
  body("is_active").optional().isBoolean().withMessage("is_active must be a boolean"),
  body("is_default").optional().isBoolean().withMessage("is_default must be a boolean"),
  body("branch_id").optional().isString().withMessage("branch_id must be a string"),
];

export const updateIntegrationProviderValidation = [
  param("id").isUUID().withMessage("Invalid provider ID"),
  body("provider_name").optional().isString().trim().notEmpty().withMessage("Provider name cannot be empty"),
  body("config").optional().isObject().withMessage("Config must be an object"),
  body("is_active").optional().isBoolean().withMessage("is_active must be a boolean"),
  body("is_default").optional().isBoolean().withMessage("is_default must be a boolean"),
];

export const getProviderByTypeValidation = [
  param("type").isIn(["EMAIL", "SMS", "WHATSAPP"]).withMessage("Invalid provider type"),
  query("branch_id").optional().isString().withMessage("branch_id must be a string"),
];

export const updateUserIntegrationSettingsValidation = [
  body("email_enabled").optional().isBoolean().withMessage("email_enabled must be a boolean"),
  body("sms_enabled").optional().isBoolean().withMessage("sms_enabled must be a boolean"),
  body("whatsapp_enabled").optional().isBoolean().withMessage("whatsapp_enabled must be a boolean"),
  body("in_app_enabled").optional().isBoolean().withMessage("in_app_enabled must be a boolean"),
  body("email_provider_id").optional().isUUID().withMessage("email_provider_id must be a valid UUID"),
  body("sms_provider_id").optional().isUUID().withMessage("sms_provider_id must be a valid UUID"),
  body("whatsapp_provider_id").optional().isUUID().withMessage("whatsapp_provider_id must be a valid UUID"),
];