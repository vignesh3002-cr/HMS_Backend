import { Router } from "express";
import { LabOrderItemController } from "./lab-order-item.controller";
import {
    createLabOrderItemValidation,
    updateLabOrderItemValidation
} from "./lab-order-item.validation";
import { authenticate } from "../auth/auth.middleware";

const router = Router();
const controller = new LabOrderItemController();

router.post(
    "/",
    authenticate,
    createLabOrderItemValidation,
    controller.create.bind(controller)
);

router.get(
    "/",
    controller.getAll.bind(controller)
);

router.get(
    "/:id",
    authenticate,
    controller.getById.bind(controller)
);

router.put(
    "/:id",
    authenticate,
    updateLabOrderItemValidation,
    controller.update.bind(controller)
);

router.delete(
    "/:id",
    authenticate,
    controller.delete.bind(controller)
);

export default router;