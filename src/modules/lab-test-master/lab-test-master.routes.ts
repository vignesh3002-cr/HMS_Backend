import { Router } from "express";
import controller from "./lab-test-master.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorizeAny } from "../../middleware/authorize";
import {
    createLabTestMasterValidation,
    updateLabTestMasterValidation
} from "./lab-test-master.validation";

const router = Router();

router.post(
    "/",
    authenticate,
    authorizeAny("lab.manage", "lab.order", "lab.result"),
    createLabTestMasterValidation,
    controller.create
);

router.get("/", authenticate, controller.getAll);
router.get("/parameters", authenticate, controller.getAllParameters);

router.get("/:id", authenticate, controller.getById);

router.put(
    "/:id",
    authenticate,
    authorizeAny("lab.manage", "lab.order", "lab.result"),
    updateLabTestMasterValidation,
    controller.update
);

router.delete(
    "/:id",
    authenticate,
    authorizeAny("lab.manage", "lab.order", "lab.result"),
    controller.delete
);

export default router;
