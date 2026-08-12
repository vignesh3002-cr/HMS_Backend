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
    authorize("lab.manage"),
    createLabTestCategoryValidation,
    controller.create
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
    authorize("lab.manage"),
    updateLabTestCategoryValidation,
    controller.update
);

router.delete(
    "/:id",
    authenticate,
    authorize("lab.manage"),
    controller.delete
);

export default router;