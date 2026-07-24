import { Router } from "express";
import { PremedicationController } from "./premedication.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createPremedicationValidation,
    updatePremedicationValidation
} from "./premedication.validation";

const router = Router();

const controller = new PremedicationController();

router.get(
    "/",
    authenticate,
    controller.getPremedications.bind(controller)
);

router.get(
    "/:premedicationId",
    authenticate,
    controller.getPremedicationById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR", "PHARMACIST"),
    createPremedicationValidation,
    controller.createPremedication.bind(controller)
);

router.put(
    "/:premedicationId",
    authenticate,
    authorize("ADMIN", "DOCTOR", "PHARMACIST"),
    updatePremedicationValidation,
    controller.updatePremedication.bind(controller)
);

router.delete(
    "/:premedicationId",
    authenticate,
    authorize("ADMIN"),
    controller.deletePremedication.bind(controller)
);

router.patch(
    "/:premedicationId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restorePremedication.bind(controller)
);

export default router;
