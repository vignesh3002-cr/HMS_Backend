import { Router } from "express";
import { ConsultationController } from "./consultation.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    listMasterValidation,
    createCustomMasterValidation,
    getPersonalHistoryValidation,
    upsertPersonalHistoryValidation,
    addReportValidation,
    updateReportValidation,
    reportIdValidation
} from "./consultation.validation";

const router = Router();
const controller = new ConsultationController();

// ---------------- Master data ----------------

router.get(
    "/masters/immunizations",
    authenticate,
    authorize("encounter.read"),
    listMasterValidation,
    controller.getImmunizations.bind(controller)
);

router.post(
    "/masters/immunizations/custom",
    authenticate,
    authorize("encounter.update"),
    createCustomMasterValidation,
    controller.createCustomImmunization.bind(controller)
);

router.get(
    "/masters/drug-consumptions",
    authenticate,
    authorize("encounter.read"),
    listMasterValidation,
    controller.getDrugConsumptions.bind(controller)
);

router.post(
    "/masters/drug-consumptions/custom",
    authenticate,
    authorize("encounter.update"),
    createCustomMasterValidation,
    controller.createCustomDrugConsumption.bind(controller)
);

router.get(
    "/masters/diet-types",
    authenticate,
    authorize("encounter.read"),
    controller.getDietTypes.bind(controller)
);

// ---------------- Personal history ----------------

router.get(
    "/encounters/:encounterNo/personal-history",
    authenticate,
    authorize("encounter.read"),
    getPersonalHistoryValidation,
    controller.getPersonalHistory.bind(controller)
);

router.put(
    "/encounters/:encounterNo/personal-history",
    authenticate,
    authorize("encounter.update"),
    upsertPersonalHistoryValidation,
    controller.upsertPersonalHistory.bind(controller)
);

// ---------------- Encounter reports ----------------

router.get(
    "/encounters/:encounterNo/reports",
    authenticate,
    authorize("encounter.read"),
    getPersonalHistoryValidation,
    controller.getReports.bind(controller)
);

router.post(
    "/encounters/:encounterNo/reports",
    authenticate,
    authorize("encounter.update"),
    addReportValidation,
    controller.addReport.bind(controller)
);

router.put(
    "/reports/:encounterReportId",
    authenticate,
    authorize("encounter.update"),
    updateReportValidation,
    controller.updateReport.bind(controller)
);

router.delete(
    "/reports/:encounterReportId",
    authenticate,
    authorize("encounter.update"),
    reportIdValidation,
    controller.removeReport.bind(controller)
);

export default router;
