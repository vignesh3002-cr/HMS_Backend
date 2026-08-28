import { Router } from "express";
import { PrescriptionController } from "./prescription.controller";
import { authenticate } from "../auth/auth.middleware";

import {
    createPrescriptionValidation,
    getPrescriptionsValidation,
    getSuggestedMedicinesValidation,
    getPrescriptionItemsValidation,
    addPrescriptionItemValidation,
    updatePrescriptionItemValidation,
    deletePrescriptionItemValidation,
    getPrescriptionByIdValidation,
    updatePrescriptionValidation,
    deletePrescriptionValidation,
    getPrescriptionsByPatientHistoryIdValidation,
    getPrescriptionsByPatientIdValidation
} from "./prescription.validation";

const router = Router();
const controller = new PrescriptionController();

router.post(
    "/",
    authenticate,
    createPrescriptionValidation,
    controller.createPrescription.bind(controller)
);

router.get(
    "/",
    authenticate,
    getPrescriptionsValidation,
    controller.getPrescriptions.bind(controller)
);

router.get(
    "/patient-history/:patientHistoryId",
    authenticate,
    getPrescriptionsByPatientHistoryIdValidation,
    controller.getPrescriptionsByPatientHistoryId.bind(controller)
);

router.get(
    "/patient/:patientId",
    authenticate,
    getPrescriptionsByPatientIdValidation,
    controller.getPrescriptionsByPatientId.bind(controller)
);

router.get(
    "/suggestions/:diagnosisId",
    authenticate,
    getSuggestedMedicinesValidation,
    controller.getSuggestedMedicines.bind(controller)
);

router.get(
    "/:prescriptionId/items",
    authenticate,
    getPrescriptionItemsValidation,
    controller.getPrescriptionItems.bind(controller)
);

router.post(
    "/:prescriptionId/items",
    authenticate,
    addPrescriptionItemValidation,
    controller.addPrescriptionItem.bind(controller)
);

router.put(
    "/:prescriptionId/items/:itemId",
    authenticate,
    updatePrescriptionItemValidation,
    controller.updatePrescriptionItem.bind(controller)
);

router.delete(
    "/:prescriptionId/items/:itemId",
    authenticate,
    deletePrescriptionItemValidation,
    controller.deletePrescriptionItem.bind(controller)
);

router.get(
    "/:prescriptionId",
    authenticate,
    getPrescriptionByIdValidation,
    controller.getPrescriptionById.bind(controller)
);

router.put(
    "/:prescriptionId",
    authenticate,
    updatePrescriptionValidation,
    controller.updatePrescription.bind(controller)
);

router.delete(
    "/:prescriptionId",
    authenticate,
    deletePrescriptionValidation,
    controller.deletePrescription.bind(controller)
);

export default router;
