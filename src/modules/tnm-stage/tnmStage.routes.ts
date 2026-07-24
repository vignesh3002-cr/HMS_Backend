import { Router } from "express";
import { TnmStageController } from "./tnmStage.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createTnmStageValidation,
    updateTnmStageValidation
} from "./tnmStage.validation";

const router = Router();

const controller = new TnmStageController();

router.get(
    "/",
    authenticate,
    controller.getTnmStages.bind(controller)
);

router.get(
    "/:tnmStageId",
    authenticate,
    controller.getTnmStageById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createTnmStageValidation,
    controller.createTnmStage.bind(controller)
);

router.put(
    "/:tnmStageId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateTnmStageValidation,
    controller.updateTnmStage.bind(controller)
);

router.delete(
    "/:tnmStageId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteTnmStage.bind(controller)
);

router.patch(
    "/:tnmStageId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreTnmStage.bind(controller)
);

export default router;
