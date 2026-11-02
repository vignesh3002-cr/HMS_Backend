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

// ?patientId= / ?appointmentId= narrow the list to a patient / one visit.
router.get(
    "/",
    authenticate,
    controller.getAll.bind(controller)
);

router.post(
    "/generate-barcode",
    authenticate,
    controller.generateBarcodes.bind(controller)
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