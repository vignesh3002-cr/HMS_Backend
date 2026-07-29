"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const treatmentPlan_controller_1 = require("./treatmentPlan.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const treatmentPlan_validation_1 = require("./treatmentPlan.validation");
const router = (0, express_1.Router)();
const controller = new treatmentPlan_controller_1.TreatmentPlanController();
router.get("/", auth_middleware_1.authenticate, controller.getTreatmentPlans.bind(controller));
router.get("/:treatmentPlanId", auth_middleware_1.authenticate, controller.getTreatmentPlanById.bind(controller));
router.post("/", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ADMIN", "DOCTOR"), treatmentPlan_validation_1.createTreatmentPlanValidation, controller.createTreatmentPlan.bind(controller));
router.put("/:treatmentPlanId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ADMIN", "DOCTOR"), treatmentPlan_validation_1.updateTreatmentPlanValidation, controller.updateTreatmentPlan.bind(controller));
// Real hospital workflow: a senior oncologist / admin must formally
// approve a plan before chemotherapy administration can start against it.
router.patch("/:treatmentPlanId/approve", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ADMIN", "DOCTOR"), controller.approveTreatmentPlan.bind(controller));
router.delete("/:treatmentPlanId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ADMIN", "DOCTOR"), controller.deleteTreatmentPlan.bind(controller));
router.patch("/:treatmentPlanId/restore", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ADMIN", "DOCTOR"), controller.restoreTreatmentPlan.bind(controller));
exports.default = router;
