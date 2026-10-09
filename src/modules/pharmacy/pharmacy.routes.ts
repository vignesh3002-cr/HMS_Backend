import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import { PharmacyController } from "./pharmacy.controller";
import {
    cancelSlipValidation,
    createSlipValidation,
    getSlipValidation,
    listSlipsValidation,
    previewSlipValidation,
    printSlipValidation,
    updateSlipItemsValidation
} from "./pharmacy.validation";

const router = Router();

const controller = new PharmacyController();

// Everything here is gated on chemo.plan.read because the slip is opened from
// the Order Master row of a chemotherapy plan. Note: PHARMACIST holds
// pharmacy.dispense, not chemo.plan.read, so a pharmacist still cannot open a
// slip - swap these to authorizeAny("pharmacy.dispense", "chemo.plan.read")
// when that is addressed.
const READ = authorize("chemo.plan.read");

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
    "/slips/:pharmacySlipId/print",
    authenticate,
    READ,
    printSlipValidation,
    controller.printSlip.bind(controller)
);

export default router;