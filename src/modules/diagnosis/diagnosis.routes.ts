import { Router } from "express";
import { DiagnosisController } from "./diagnosis.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createDiagnosisValidation,
    updateDiagnosisValidation
} from "./diagnosis.validation";

const router = Router();

const controller = new DiagnosisController();

router.get(
    "/",
    authenticate,
    controller.getDiagnoses.bind(controller)
);

router.get(
    "/:diagnosisId",
    authenticate,
    controller.getDiagnosisById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createDiagnosisValidation,
    controller.createDiagnosis.bind(controller)
);

router.put(
    "/:diagnosisId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateDiagnosisValidation,
    controller.updateDiagnosis.bind(controller)
);

router.delete(
    "/:diagnosisId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    controller.deleteDiagnosis.bind(controller)
);

router.patch(
    "/:diagnosisId/restore",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    controller.restoreDiagnosis.bind(controller)
);

export default router;
