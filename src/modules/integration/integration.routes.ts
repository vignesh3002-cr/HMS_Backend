import { Router } from "express";
import { IntegrationController } from "./integration.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize, authorizeAny } from "../../middleware/authorize";
import {
  createIntegrationProviderValidation,
  updateIntegrationProviderValidation,
  getProviderByTypeValidation,
  updateUserIntegrationSettingsValidation,
} from "./integration.validation";

const router = Router();
const controller = new IntegrationController();

router.use(authenticate);

router.get("/providers", authorizeAny("integration.read", "system.config"), controller.getProviders.bind(controller));
router.get("/providers/type/:type", authorizeAny("integration.read", "system.config"), getProviderByTypeValidation, controller.getProviderByType.bind(controller));
router.get("/providers/:id", authorizeAny("integration.read", "system.config"), controller.getProviderById.bind(controller));
router.post("/providers", authorizeAny("integration.write", "system.config"), createIntegrationProviderValidation, controller.createProvider.bind(controller));
router.put("/providers/:id", authorizeAny("integration.write", "system.config"), updateIntegrationProviderValidation, controller.updateProvider.bind(controller));
router.delete("/providers/:id", authorizeAny("integration.write", "system.config"), controller.deleteProvider.bind(controller));

// Authenticated users manage their own notification toggles
router.get("/settings", controller.getUserSettings.bind(controller));
router.put("/settings", updateUserIntegrationSettingsValidation, controller.updateUserSettings.bind(controller));

router.get("/providers/type/:type/config", authorizeAny("integration.read", "system.config"), getProviderByTypeValidation, controller.getProviderConfig.bind(controller));

router.post("/sms-otp", authorizeAny("integration.write", "system.config"), controller.sendSMSOTP.bind(controller));
router.post("/test/email", authorizeAny("integration.write", "system.config"), controller.testEmail.bind(controller));
router.post("/test/sms", authorizeAny("integration.write", "system.config"), controller.testSms.bind(controller));
router.post("/test/whatsapp", authorizeAny("integration.write", "system.config"), controller.testWhatsApp.bind(controller));

export default router;
