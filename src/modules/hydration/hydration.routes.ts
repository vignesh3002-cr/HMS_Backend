import { Router } from "express";
import { HydrationController } from "./hydration.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createHydrationValidation,
    updateHydrationValidation
} from "./hydration.validation";

const router = Router();

const controller = new HydrationController();

router.get(
    "/",
    authenticate,
    controller.getHydrations.bind(controller)
);

router.get(
    "/:hydrationId",
    authenticate,
    controller.getHydrationById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR", "PHARMACIST"),
    createHydrationValidation,
    controller.createHydration.bind(controller)
);

router.put(
    "/:hydrationId",
    authenticate,
    authorize("ADMIN", "DOCTOR", "PHARMACIST"),
    updateHydrationValidation,
    controller.updateHydration.bind(controller)
);

router.delete(
    "/:hydrationId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteHydration.bind(controller)
);

router.patch(
    "/:hydrationId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreHydration.bind(controller)
);

export default router;
