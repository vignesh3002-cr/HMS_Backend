import { Router } from "express";

import controller from "./lab-test-category.controller";

import {
    createLabTestCategoryValidation,
    updateLabTestCategoryValidation
} from "./lab-test-category.validation";

const router = Router();

router.post(
    "/",
    createLabTestCategoryValidation,
    controller.create
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
    updateLabTestCategoryValidation,
    controller.update
);

router.delete(
    "/:id",
    controller.delete
);

export default router;