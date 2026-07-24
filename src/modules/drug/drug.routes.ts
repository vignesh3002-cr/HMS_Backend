import { Router } from "express";
console.log("Drug routes loaded");
import { DrugController } from "./drug.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createDrugValidation,
    updateDrugValidation
} from "./drug.validation";

const router = Router();

const controller = new DrugController();

router.get(
    "/",
    authenticate,
    controller.getDrugs.bind(controller)
);

router.get(
    "/:drugId",
    authenticate,
    controller.getDrugById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR", "PHARMACIST"),
    createDrugValidation,
    controller.createDrug.bind(controller)
);

router.put(
    "/:drugId",
    authenticate,
    authorize("ADMIN", "DOCTOR", "PHARMACIST"),
    updateDrugValidation,
    controller.updateDrug.bind(controller)
);

router.delete(
    "/:drugId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteDrug.bind(controller)
);

router.patch(
    "/:drugId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreDrug.bind(controller)
);

export default router;
