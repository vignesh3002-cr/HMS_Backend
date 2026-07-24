import { Router } from "express";
import { CancerTypeController } from "./cancerType.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createCancerTypeValidation,
    updateCancerTypeValidation
} from "./cancerType.validation";

const router = Router();

const controller = new CancerTypeController();

router.get(
    "/",
    authenticate,
    controller.getCancerTypes.bind(controller)
);

router.get(
    "/:cancerTypeId",
    authenticate,
    controller.getCancerTypeById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createCancerTypeValidation,
    controller.createCancerType.bind(controller)
);

router.put(
    "/:cancerTypeId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateCancerTypeValidation,
    controller.updateCancerType.bind(controller)
);

router.delete(
    "/:cancerTypeId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteCancerType.bind(controller)
);

router.patch(
    "/:cancerTypeId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreCancerType.bind(controller)
);

export default router;
