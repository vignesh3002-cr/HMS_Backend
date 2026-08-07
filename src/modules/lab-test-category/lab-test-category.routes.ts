import { Router } from "express";

import controller from "./lab-test-category.controller";

import {
    createLabTestCategoryValidation,
    updateLabTestCategoryValidation
} from "./lab-test-category.validation";

const router = Router();

import { authenticate } from "../auth/auth.middleware";

router.post(
    "/",
    authenticate,
    createLabTestCategoryValidation,
    controller.create.bind(controller)
);


router.get(
    "/",
    controller.getAll
);

router.get(
    "/:id",
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