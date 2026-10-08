"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const pharmacy_controller_1 = require("./pharmacy.controller");
const pharmacy_validation_1 = require("./pharmacy.validation");
const router = (0, express_1.Router)();
const controller = new pharmacy_controller_1.PharmacyController();
// Everything here is gated on chemo.plan.read because the slip is opened from
// the Order Master row of a chemotherapy plan. Note: PHARMACIST holds
// pharmacy.dispense, not chemo.plan.read, so a pharmacist still cannot open a
// slip - swap these to authorizeAny("pharmacy.dispense", "chemo.plan.read")
// when that is addressed.
const READ = (0, authorize_1.authorize)("chemo.plan.read");
router.get("/slips/preview/plan/:planId", auth_middleware_1.authenticate, READ, pharmacy_validation_1.previewSlipValidation, controller.previewSlip.bind(controller));
router.post("/slips/from-plan", auth_middleware_1.authenticate, READ, pharmacy_validation_1.createSlipValidation, controller.createSlip.bind(controller));
// Declared before "/slips/:pharmacySlipId" so "slips" is not read as an id.
router.get("/slips", auth_middleware_1.authenticate, READ, pharmacy_validation_1.listSlipsValidation, controller.listSlips.bind(controller));
router.get("/slips/:pharmacySlipId", auth_middleware_1.authenticate, READ, pharmacy_validation_1.getSlipValidation, controller.getSlip.bind(controller));
router.put("/slips/:pharmacySlipId/items", auth_middleware_1.authenticate, READ, pharmacy_validation_1.updateSlipItemsValidation, controller.updateItems.bind(controller));
router.post("/slips/:pharmacySlipId/cancel", auth_middleware_1.authenticate, READ, pharmacy_validation_1.cancelSlipValidation, controller.cancelSlip.bind(controller));
router.post("/slips/:pharmacySlipId/print", auth_middleware_1.authenticate, READ, pharmacy_validation_1.printSlipValidation, controller.printSlip.bind(controller));
exports.default = router;
