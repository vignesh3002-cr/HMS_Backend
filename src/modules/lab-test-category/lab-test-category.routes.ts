import { Router } from "express";
import controller from "./lab-test-category.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createLabTestCategoryValidation,
    updateLabTestCategoryValidation
} from "./lab-test-category.validation";

const router = Router();



router.post(
    "/",
    authenticate,
    createLabTestCategoryValidation,
    controller.create.bind(controller)
);


router.get(
    "/",
    authenticate,
    authorize("lab.manage"),
    controller.getAll
);

router.get(
    "/:id",
    authenticate,
    authorize("lab.manage"),
    controller.getById
);

router.put(
    "/:id",
    authenticate,
    updateLabTestCategoryValidation,
    controller.update.bind(controller)
);

router.delete(
    "/:id",
    authenticate,
    controller.delete.bind(controller)
);
export default router;