import { Router } from "express";
import { HistomorphologyController } from "./histomorphology.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createHistomorphologyValidation,
    updateHistomorphologyValidation
} from "./histomorphology.validation";

const router = Router();

const controller = new HistomorphologyController();

router.get(
    "/",
    authenticate,
    controller.getHistomorphologies.bind(controller)
);

router.get(
    "/:histomorphologyId",
    authenticate,
    controller.getHistomorphologyById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createHistomorphologyValidation,
    controller.createHistomorphology.bind(controller)
);

router.put(
    "/:histomorphologyId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateHistomorphologyValidation,
    controller.updateHistomorphology.bind(controller)
);

router.delete(
    "/:histomorphologyId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteHistomorphology.bind(controller)
);

router.patch(
    "/:histomorphologyId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreHistomorphology.bind(controller)
);

export default router;
