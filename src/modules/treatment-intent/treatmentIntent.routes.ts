import { Router } from "express";
import { TreatmentIntentController } from "./treatmentIntent.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createTreatmentIntentValidation,
    updateTreatmentIntentValidation
} from "./treatmentIntent.validation";

const router = Router();

const controller = new TreatmentIntentController();

router.get(
    "/",
    authenticate,
    controller.getTreatmentIntents.bind(controller)
);

router.get(
    "/:treatmentIntentId",
    authenticate,
    controller.getTreatmentIntentById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createTreatmentIntentValidation,
    controller.createTreatmentIntent.bind(controller)
);

router.put(
    "/:treatmentIntentId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateTreatmentIntentValidation,
    controller.updateTreatmentIntent.bind(controller)
);

router.delete(
    "/:treatmentIntentId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteTreatmentIntent.bind(controller)
);

router.patch(
    "/:treatmentIntentId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreTreatmentIntent.bind(controller)
);

export default router;
