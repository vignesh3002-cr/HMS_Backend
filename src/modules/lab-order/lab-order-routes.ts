import { Router } from "express";
import controller from "./lab-order-controller";

import {
    createLabOrderValidation,
    updateLabOrderValidation
} from "./lab-order-validation";

const router = Router();

import { authenticate } from "../auth/auth.middleware";

router.post(
    "/",
    authenticate,
    createLabOrderValidation,
    controller.create
);

router.get(
    "/",
    controller.getAll
);

router.get(
    "/:id",
    controller.getById
);

router.put(
    "/:id",
    authenticate,
    updateLabOrderValidation,
    controller.update
);

router.delete(
    "/:id",
    authenticate,
    controller.delete
);

export default router;