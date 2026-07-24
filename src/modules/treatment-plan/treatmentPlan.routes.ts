import { Router } from "express";
import { TreatmentPlanController } from "./treatmentPlan.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createTreatmentPlanValidation,
    updateTreatmentPlanValidation
} from "./treatmentPlan.validation";

const router = Router();

const controller = new TreatmentPlanController();

router.get(
    "/",
    authenticate,
    controller.getTreatmentPlans.bind(controller)
);

router.get(
    "/:treatmentPlanId",
    authenticate,
    controller.getTreatmentPlanById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createTreatmentPlanValidation,
    controller.createTreatmentPlan.bind(controller)
);

router.put(
    "/:treatmentPlanId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateTreatmentPlanValidation,
    controller.updateTreatmentPlan.bind(controller)
);

// Real hospital workflow: a senior oncologist / admin must formally
// approve a plan before chemotherapy administration can start against it.
router.patch(
    "/:treatmentPlanId/approve",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    controller.approveTreatmentPlan.bind(controller)
);

router.delete(
    "/:treatmentPlanId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    controller.deleteTreatmentPlan.bind(controller)
);

router.patch(
    "/:treatmentPlanId/restore",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    controller.restoreTreatmentPlan.bind(controller)
);

export default router;
