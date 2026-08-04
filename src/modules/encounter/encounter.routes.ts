import { Router } from "express";
import { EncounterController } from "./encounter.controller";
import { authenticate } from "../auth/auth.middleware";
<<<<<<< HEAD
=======
import { authorize } from "../../middleware/authorize";
import { branchScope } from "../../middleware/branchScope";
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
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
<<<<<<< HEAD
=======
    authorize("encounter.create"),
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
    createEncounterValidation,
    controller.createEncounter.bind(controller)
);

router.get(
    "/",
    authenticate,
<<<<<<< HEAD
=======
    authorize("encounter.read"),
    branchScope,
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
    getEncountersValidation,
    controller.getEncounters.bind(controller)
);

router.get(
    "/:encounterNo",
    authenticate,
<<<<<<< HEAD
=======
    authorize("encounter.read"),
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
    controller.getEncounterByNumber.bind(controller)
);

router.put(
    "/:encounterNo/close",
    authenticate,
<<<<<<< HEAD
=======
    authorize("encounter.update"),
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
    closeEncounterValidation,
    controller.closeEncounter.bind(controller)
);

router.put(
    "/:encounterNo",
    authenticate,
<<<<<<< HEAD
=======
    authorize("encounter.update"),
>>>>>>> 0a8fdcbc6838eddba90bba2049f5294dba65cd77
    updateEncounterValidation,
    controller.updateEncounter.bind(controller)
);

export default router;
