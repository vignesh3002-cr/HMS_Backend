import { Router } from "express";
import { IcdCodeController } from "./icdCode.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createIcdCodeValidation,
    updateIcdCodeValidation
} from "./icdCode.validation";

const router = Router();

const controller = new IcdCodeController();

router.get(
    "/",
    authenticate,
    controller.getIcdCodes.bind(controller)
);

router.get(
    "/:icdCodeId",
    authenticate,
    controller.getIcdCodeById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createIcdCodeValidation,
    controller.createIcdCode.bind(controller)
);

router.put(
    "/:icdCodeId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateIcdCodeValidation,
    controller.updateIcdCode.bind(controller)
);

router.delete(
    "/:icdCodeId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteIcdCode.bind(controller)
);

router.patch(
    "/:icdCodeId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreIcdCode.bind(controller)
);

export default router;
