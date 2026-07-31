import { Router } from "express";
import controller from "./lab-order-controller";

import {
    createLabOrderValidation,
    updateLabOrderValidation
} from "./lab-order-validation";

const router = Router();

router.post(
    "/",
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
    updateLabOrderValidation,
    controller.update
);

router.delete(
    "/:id",
    controller.delete
);

export default router;