import { Router } from "express";
import controller from "./lab-test-master.controller";

import {
    createLabTestMasterValidation,
    updateLabTestMasterValidation
} from "./lab-test-master.validation";

const router = Router();

router.post("/", createLabTestMasterValidation, controller.create);

router.get("/", controller.getAll);

router.get("/:id", controller.getById);

router.put("/:id", updateLabTestMasterValidation, controller.update);

router.delete("/:id", controller.delete);

export default router;