import { Router } from "express";
import { HistologicalGradeController } from "./histologicalGrade.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    createHistologicalGradeValidation,
    updateHistologicalGradeValidation
} from "./histologicalGrade.validation";

const router = Router();

const controller = new HistologicalGradeController();

router.get(
    "/",
    authenticate,
    controller.getHistologicalGrades.bind(controller)
);

router.get(
    "/:histologicalGradeId",
    authenticate,
    controller.getHistologicalGradeById.bind(controller)
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    createHistologicalGradeValidation,
    controller.createHistologicalGrade.bind(controller)
);

router.put(
    "/:histologicalGradeId",
    authenticate,
    authorize("ADMIN", "DOCTOR"),
    updateHistologicalGradeValidation,
    controller.updateHistologicalGrade.bind(controller)
);

router.delete(
    "/:histologicalGradeId",
    authenticate,
    authorize("ADMIN"),
    controller.deleteHistologicalGrade.bind(controller)
);

router.patch(
    "/:histologicalGradeId/restore",
    authenticate,
    authorize("ADMIN"),
    controller.restoreHistologicalGrade.bind(controller)
);

export default router;
