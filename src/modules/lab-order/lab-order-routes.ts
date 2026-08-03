import { Router } from "express";
import controller from "./lab-order-controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import { branchScope } from "../../middleware/branchScope";
import {
    createLabOrderValidation,
    updateLabOrderValidation
} from "./lab-order-validation";

const router = Router();

router.post(
    "/",
    authenticate,
    authorize("lab.order"),
    createLabOrderValidation,
    controller.create
);

router.get(
    "/",
    authenticate,
    authorize("lab.order"),
    branchScope,
    controller.getAll
);

router.get(
    "/:id",
    authenticate,
    authorize("lab.order"),
    controller.getById
);

router.put(
    "/:id",
    authenticate,
    authorize("lab.order"),
    updateLabOrderValidation,
    controller.update
);

router.delete(
    "/:id",
    authenticate,
    authorize("lab.order"),
    controller.delete
);

export default router;