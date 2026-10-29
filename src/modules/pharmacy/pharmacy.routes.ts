import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { authorizeAny } from "../../middleware/authorize";
import { PharmacyController } from "./pharmacy.controller";
import {
    amendSlipValidation,
    cancelSlipValidation,
    createMedicineValidation,
    createSlipValidation,
    getSlipValidation,
    issueSlipValidation,
    listSlipsValidation,
    previewSlipValidation,
    printSlipValidation,
    updateSlipItemsValidation
} from "./pharmacy.validation";

const router = Router();

const controller = new PharmacyController();

// Accessible by either Pharmacists (pharmacy.dispense) or Oncologists (chemo.plan.read)
const READ = authorizeAny("pharmacy.dispense", "chemo.plan.read");

router.get(
    "/master-items",
    authenticate,
    READ,
    controller.listMasterItems.bind(controller)
);

router.post(
    "/medicines",
    authenticate,
    READ,
    createMedicineValidation,
    controller.createMedicine.bind(controller)
);

router.get(
    "/slips/preview/plan/:planId",
    authenticate,
    READ,
    previewSlipValidation,
    controller.previewSlip.bind(controller)
);

router.post(
    "/slips/from-plan",
    authenticate,
    READ,
    createSlipValidation,
    controller.createSlip.bind(controller)
);

// Declared before "/slips/:pharmacySlipId" so "slips" is not read as an id.
router.get(
    "/slips",
    authenticate,
    READ,
    listSlipsValidation,
    controller.listSlips.bind(controller)
);

router.get(
    "/slips/:pharmacySlipId",
    authenticate,
    READ,
    getSlipValidation,
    controller.getSlip.bind(controller)
);

router.put(
    "/slips/:pharmacySlipId/items",
    authenticate,
    READ,
    updateSlipItemsValidation,
    controller.updateItems.bind(controller)
);

router.post(
    "/slips/:pharmacySlipId/cancel",
    authenticate,
    READ,
    cancelSlipValidation,
    controller.cancelSlip.bind(controller)
);

router.post(
    "/slips/:pharmacySlipId/issue",
    authenticate,
    READ,
    issueSlipValidation,
    controller.issueSlip.bind(controller)
);

router.post(
    "/slips/:pharmacySlipId/amend",
    authenticate,
    READ,
    amendSlipValidation,
    controller.amendSlip.bind(controller)
);

router.post(
    "/slips/:pharmacySlipId/print",
    authenticate,
    READ,
    printSlipValidation,
    controller.printSlip.bind(controller)
);

export default router;