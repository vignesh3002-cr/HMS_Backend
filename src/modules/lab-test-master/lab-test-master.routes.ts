import { Router } from "express";
import controller from "./lab-test-master.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createLabTestMasterValidation,
    updateLabTestMasterValidation
} from "./lab-test-master.validation";

const router = Router();

router.post("/", authenticate, authorize("lab.manage"), createLabTestMasterValidation, controller.create);

router.get("/", authenticate, controller.getAll);

router.get("/:id", authenticate, authorize("lab.manage"), controller.getById);

router.put("/:id", authenticate, authorize("lab.manage"), updateLabTestMasterValidation, controller.update);

router.delete("/:id", authenticate, authorize("lab.manage"), controller.delete);

export default router;