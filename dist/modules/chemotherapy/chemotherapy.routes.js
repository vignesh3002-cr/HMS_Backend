"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chemotherapy_controller_1 = require("./chemotherapy.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const authorize_1 = require("../../middleware/authorize");
const chemotherapy_validation_1 = require("./chemotherapy.validation");
const router = (0, express_1.Router)();
const controller = new chemotherapy_controller_1.ChemotherapyController();
// ---------------- Regimen protocols ----------------
// Registered before "/plans/:planId" etc. so "/regimen-protocols" and its
// sub-paths are never swallowed by a param route (same trap documented in
// branch.routes.ts / appointment.routes.ts).
router.get("/regimen-protocols", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), chemotherapy_validation_1.listRegimenProtocolsValidation, controller.listRegimenProtocols.bind(controller));
// ---------------- Personalized regimen protocols ----------------
// CRITICAL: all of these MUST be registered before "/regimen-protocols/:protocolId"
// (and the ":protocolId" PUT) below - otherwise "personalized" would be captured
// by the ":protocolId" param and these routes would 404/mis-route.
router.get("/regimen-protocols/personalized", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), controller.listPersonalizedProtocols.bind(controller));
router.get("/regimen-protocols/personalized/:protocolId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), chemotherapy_validation_1.getRegimenProtocolValidation, controller.getPersonalizedProtocol.bind(controller));
router.post("/regimen-protocols/:protocolId/personalize", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.personalizeRegimenProtocolValidation, controller.personalizeProtocol.bind(controller));
router.put("/regimen-protocols/personalized/:protocolId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.updatePersonalizedProtocolValidation, controller.updatePersonalizedProtocol.bind(controller));
router.post("/regimen-protocols/personalized/:protocolId/items", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.addPersonalizedProtocolItemValidation, controller.addPersonalizedProtocolItem.bind(controller));
router.put("/regimen-protocols/personalized/:protocolId/items/:protocolItemId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.updatePersonalizedProtocolItemValidation, controller.updatePersonalizedProtocolItem.bind(controller));
router.delete("/regimen-protocols/personalized/:protocolId/items/:protocolItemId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.removePersonalizedProtocolItemValidation, controller.removePersonalizedProtocolItem.bind(controller));
router.post("/regimen-protocols/personalized/:protocolId/days", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.addPersonalizedProtocolDayValidation, controller.addPersonalizedProtocolDay.bind(controller));
router.put("/regimen-protocols/personalized/:protocolId/days/:protocolDayId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.updatePersonalizedProtocolDayValidation, controller.updatePersonalizedProtocolDay.bind(controller));
router.delete("/regimen-protocols/personalized/:protocolId/days/:protocolDayId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.removePersonalizedProtocolDayValidation, controller.removePersonalizedProtocolDay.bind(controller));
router.post("/regimen-protocols/personalized/:protocolId/items/:protocolItemId/dilutions", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.addPersonalizedProtocolDilutionValidation, controller.addPersonalizedProtocolDilution.bind(controller));
router.put("/regimen-protocols/personalized/:protocolId/items/:protocolItemId/dilutions/:protocolDilutionId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.updatePersonalizedProtocolDilutionValidation, controller.updatePersonalizedProtocolDilution.bind(controller));
router.delete("/regimen-protocols/personalized/:protocolId/items/:protocolItemId/dilutions/:protocolDilutionId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.removePersonalizedProtocolDilutionValidation, controller.removePersonalizedProtocolDilution.bind(controller));
router.post("/regimen-protocols/personalized/:protocolId/activate", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.getRegimenProtocolValidation, controller.activatePersonalizedProtocol.bind(controller));
router.post("/regimen-protocols/personalized/:protocolId/version", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.createPersonalizedProtocolVersionValidation, controller.createPersonalizedProtocolVersion.bind(controller));
router.get("/regimen-protocols/:protocolId/discharge-medicines", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), chemotherapy_validation_1.getRegimenProtocolValidation, controller.getDischargeMedicinesForProtocol.bind(controller));
router.get("/regimen-protocols/:protocolId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), chemotherapy_validation_1.getRegimenProtocolValidation, controller.getRegimenProtocol.bind(controller));
router.get("/regimen-protocols/:protocolId/discharge-medicines", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), chemotherapy_validation_1.getRegimenProtocolValidation, controller.getDischargeMedicinesForProtocol.bind(controller));
router.get("/medicines", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), controller.listAllActiveMedicines.bind(controller));
router.get("/medicines/dilution-medicines", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), controller.listDilutionMedicines.bind(controller));
router.get("/medicines/by-cancer-subtype", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), controller.getMedicinesByCancerTypeAndSubtype.bind(controller));
router.get("/medicines/by-role", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), controller.listMedicinesByDrugRole.bind(controller));
router.get("/protocol-field-options", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), controller.getProtocolFieldOptions.bind(controller));
router.post("/regimen-protocols", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.createRegimenProtocolValidation, controller.createRegimenProtocol.bind(controller));
router.put("/regimen-protocols/:protocolId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.updateRegimenProtocolValidation, controller.updateRegimenProtocol.bind(controller));
router.post("/regimen-protocols/:protocolId/items", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.addRegimenProtocolItemValidation, controller.addRegimenProtocolItem.bind(controller));
router.put("/regimen-protocols/:protocolId/items/:protocolItemId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.updateRegimenProtocolItemValidation, controller.updateRegimenProtocolItem.bind(controller));
router.delete("/regimen-protocols/:protocolId/items/:protocolItemId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), controller.removeRegimenProtocolItem.bind(controller));
router.post("/regimen-protocols/:protocolId/discharge-instructions", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.addDischargeInstructionValidation, controller.addDischargeInstruction.bind(controller));
router.put("/regimen-protocols/:protocolId/discharge-instructions/:dischargeInstructionId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.updateDischargeInstructionValidation, controller.updateDischargeInstruction.bind(controller));
router.delete("/regimen-protocols/:protocolId/discharge-instructions/:dischargeInstructionId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.manage"), chemotherapy_validation_1.removeDischargeInstructionValidation, controller.removeDischargeInstruction.bind(controller));
// ---------------- Plan ----------------
router.get("/plans/preview", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.previewPlanValidation, controller.previewPlan.bind(controller));
router.post("/plans", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.create"), chemotherapy_validation_1.createPlanValidation, controller.createPlan.bind(controller));
router.get("/plans", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.listPlansValidation, controller.listPlans.bind(controller));
router.get("/plans/latest-for-patient", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), controller.getLatestPlanForPatient.bind(controller));
router.get("/plans/:planId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.planIdParamValidation, controller.getPlan.bind(controller));
router.put("/plans/:planId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.update"), chemotherapy_validation_1.updatePlanValidation, controller.updatePlan.bind(controller));
router.patch("/plans/:planId/status", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.update"), chemotherapy_validation_1.planStatusValidation, controller.changePlanStatus.bind(controller));
// ---------------- Plan items ----------------
router.post("/plans/:planId/items", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.update"), chemotherapy_validation_1.addPlanItemValidation, controller.addPlanItem.bind(controller));
router.put("/plans/:planId/items/:planItemId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.update"), chemotherapy_validation_1.updatePlanItemValidation, controller.updatePlanItem.bind(controller));
router.delete("/plans/:planId/items/:planItemId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.update"), controller.removePlanItem.bind(controller));
// ---------------- Cycles ----------------
router.post("/plans/:planId/cycles", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.cycle.manage"), chemotherapy_validation_1.createCycleValidation, controller.createCycle.bind(controller));
router.get("/plans/:planId/cycles", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.planIdParamValidation, controller.listCyclesForPlan.bind(controller));
router.get("/cycles/:cycleId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.cycleIdParamValidation, controller.getCycle.bind(controller));
router.put("/cycles/:cycleId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.cycle.manage"), chemotherapy_validation_1.updateCycleValidation, controller.updateCycle.bind(controller));
router.patch("/cycles/:cycleId/status", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.cycle.manage"), chemotherapy_validation_1.cycleStatusValidation, controller.changeCycleStatus.bind(controller));
// ---------------- Administration ----------------
router.post("/cycles/:cycleId/administration", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.administration.record"), chemotherapy_validation_1.recordAdministrationValidation, controller.recordAdministration.bind(controller));
router.get("/cycles/:cycleId/administration", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.cycleIdParamValidation, controller.listAdministrations.bind(controller));
// ---------------- Vitals ----------------
router.post("/cycles/:cycleId/vitals", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.vitals.record"), chemotherapy_validation_1.recordVitalsValidation, controller.recordVitals.bind(controller));
router.get("/cycles/:cycleId/vitals", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.cycleIdParamValidation, controller.listVitals.bind(controller));
// ---------------- Adverse events ----------------
router.post("/cycles/:cycleId/adverse-events", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.adverse_event.record"), chemotherapy_validation_1.recordAdverseEventValidation, controller.recordAdverseEvent.bind(controller));
router.get("/cycles/:cycleId/adverse-events", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.cycleIdParamValidation, controller.listAdverseEvents.bind(controller));
// ---------------- Lab review ----------------
router.post("/cycles/:cycleId/lab-review", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.lab_review.record"), chemotherapy_validation_1.recordLabReviewValidation, controller.recordLabReview.bind(controller));
router.get("/cycles/:cycleId/lab-review", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.cycleIdParamValidation, controller.listLabReviews.bind(controller));
// ---------------- Followup ----------------
router.post("/cycles/:cycleId/followup", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.followup.record"), chemotherapy_validation_1.recordFollowupValidation, controller.recordFollowup.bind(controller));
router.get("/cycles/:cycleId/followup", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.plan.read"), chemotherapy_validation_1.cycleIdParamValidation, controller.listFollowups.bind(controller));
router.get("/supportive-medicines", auth_middleware_1.authenticate, (0, authorize_1.authorize)("chemo.protocol.read"), controller.listSupportiveMedicines.bind(controller));
exports.default = router;
