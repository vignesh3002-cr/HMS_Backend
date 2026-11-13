import { Router } from "express";
import { IntegrationController } from "./integration.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
  createIntegrationProviderValidation,
  updateIntegrationProviderValidation,
  getProviderByTypeValidation,
  updateUserIntegrationSettingsValidation,
} from "./integration.validation";

const router = Router();
const controller = new IntegrationController();

router.use(authenticate);

router.get("/providers", authorize("integration.read"), controller.getProviders.bind(controller));
router.get("/providers/type/:type", authorize("integration.read"), getProviderByTypeValidation, controller.getProviderByType.bind(controller));
router.get("/providers/:id", authorize("integration.read"), controller.getProviderById.bind(controller));
router.post("/providers", authorize("integration.write"), createIntegrationProviderValidation, controller.createProvider.bind(controller));
router.put("/providers/:id", authorize("integration.write"), updateIntegrationProviderValidation, controller.updateProvider.bind(controller));
router.delete("/providers/:id", authorize("integration.write"), controller.deleteProvider.bind(controller));

router.get("/settings", authorize("integration.read"), controller.getUserSettings.bind(controller));
router.put("/settings", authorize("integration.write"), updateUserIntegrationSettingsValidation, controller.updateUserSettings.bind(controller));

router.get("/providers/type/:type/config", authorize("integration.read"), getProviderByTypeValidation, controller.getProviderConfig.bind(controller));

export default router;