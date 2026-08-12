import { Router } from "express";
import { EncounterController } from "./encounter.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import { branchScope } from "../../middleware/branchScope";
import {
    createEncounterValidation,
    updateEncounterValidation,
    closeEncounterValidation,
    getEncountersValidation
} from "./encounter.validation";

const router = Router();

const controller = new EncounterController();

router.post(
    "/",
    authenticate,
    authorize("encounter.create"),
    createEncounterValidation,
    controller.createEncounter.bind(controller)
);

router.get(
    "/",
    authenticate,
    authorize("encounter.read"),
    branchScope,
    getEncountersValidation,
    controller.getEncounters.bind(controller)
);

router.get(
    "/:encounterNo",
    authenticate,
    authorize("encounter.read"),
    controller.getEncounterByNumber.bind(controller)
);

router.put(
    "/:encounterNo/close",
    authenticate,
    authorize("encounter.update"),
    closeEncounterValidation,
    controller.closeEncounter.bind(controller)
);

router.put(
    "/:encounterNo",
    authenticate,
    authorize("encounter.update"),
    updateEncounterValidation,
    controller.updateEncounter.bind(controller)
);

export default router;
