import { Router } from "express";
import { CancerStageController } from "./cancerStage.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createCancerStageValidation,
    updateCancerStageValidation
} from "./cancerStage.validation";

const router = Router();

const controller = new CancerStageController();

router.get(
    "/",
    authenticate,
    controller.getCancerStages.bind(controller)
);

router.get(
    "/:cancerStageId",
    authenticate,
    controller.getCancerStageById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createCancerStageValidation,
    controller.createCancerStage.bind(controller)
);

router.put(
    "/:cancerStageId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateCancerStageValidation,
    controller.updateCancerStage.bind(controller)
);

router.delete(
    "/:cancerStageId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteCancerStage.bind(controller)
);

router.patch(
    "/:cancerStageId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreCancerStage.bind(controller)
);

export default router;
