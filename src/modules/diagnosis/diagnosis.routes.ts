import { Router } from "express";
import { DiagnosisController } from "./diagnosis.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import { branchScope } from "../../middleware/branchScope";
import {
    getDiagnosisCategoriesValidation,
    getDiagnosesByCategoryValidation,
    getDiagnosisByIdValidation,
} from "./diagnosis.validation";

const router = Router();

const controller = new DiagnosisController();

// Get all diagnosis categories (with counts)
router.get(
    "/categories",
    authenticate,
    getDiagnosisCategoriesValidation,
    controller.getDiagnosisCategories.bind(controller)
);

// Get diagnoses by category ID
router.get(
    "/categories/:categoryId/diagnoses",
    authenticate,
    getDiagnosesByCategoryValidation,
    controller.getDiagnosesByCategory.bind(controller)
);

// Get single diagnosis by ID
router.get(
    "/:diagnosisId",
    authenticate,
    getDiagnosisByIdValidation,
    controller.getDiagnosisById.bind(controller)
);

export default router;