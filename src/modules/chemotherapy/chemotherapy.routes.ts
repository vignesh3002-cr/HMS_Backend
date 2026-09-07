import { Router } from "express";
import { ChemotherapyController } from "./chemotherapy.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
    previewPlanValidation,
    createPlanValidation,
    updatePlanValidation,
    planStatusValidation,
    listPlansValidation,
    addPlanItemValidation,
    updatePlanItemValidation,
    createCycleValidation,
    cycleStatusValidation,
    updateCycleValidation,
    recordAdministrationValidation,
    recordVitalsValidation,
    recordAdverseEventValidation,
    recordLabReviewValidation,
    recordFollowupValidation,
    cycleIdParamValidation,
    planIdParamValidation,
    listRegimenProtocolsValidation,
    getRegimenProtocolValidation,
    createRegimenProtocolValidation,
    updateRegimenProtocolValidation,
    addRegimenProtocolItemValidation,
    updateRegimenProtocolItemValidation,
    addDischargeInstructionValidation,
    updateDischargeInstructionValidation,
    removeDischargeInstructionValidation,
    personalizeRegimenProtocolValidation,
    updatePersonalizedProtocolValidation,
    addPersonalizedProtocolItemValidation,
    updatePersonalizedProtocolItemValidation,
    removePersonalizedProtocolItemValidation,
    addPersonalizedProtocolDayValidation,
    updatePersonalizedProtocolDayValidation,
    removePersonalizedProtocolDayValidation,
    addPersonalizedProtocolDilutionValidation,
    updatePersonalizedProtocolDilutionValidation,
    removePersonalizedProtocolDilutionValidation,
    createPersonalizedProtocolVersionValidation
} from "./chemotherapy.validation";

const router = Router();
const controller = new ChemotherapyController();

// ---------------- Regimen protocols ----------------
// Registered before "/plans/:planId" etc. so "/regimen-protocols" and its
// sub-paths are never swallowed by a param route (same trap documented in
// branch.routes.ts / appointment.routes.ts).


router.get(
    "/regimen-protocols",
    authenticate,
    authorize("chemo.protocol.read"),
    listRegimenProtocolsValidation,
    controller.listRegimenProtocols.bind(controller)
);

// ---------------- Personalized regimen protocols ----------------
// CRITICAL: all of these MUST be registered before "/regimen-protocols/:protocolId"
// (and the ":protocolId" PUT) below - otherwise "personalized" would be captured
// by the ":protocolId" param and these routes would 404/mis-route.

router.get(
    "/regimen-protocols/personalized",
    authenticate,
    authorize("chemo.protocol.read"),
    controller.listPersonalizedProtocols.bind(controller)
);

router.get(
    "/regimen-protocols/personalized/:protocolId",
    authenticate,
    authorize("chemo.protocol.read"),
    getRegimenProtocolValidation,
    controller.getPersonalizedProtocol.bind(controller)
);

router.post(
    "/regimen-protocols/:protocolId/personalize",
    authenticate,
    authorize("chemo.protocol.manage"),
    personalizeRegimenProtocolValidation,
    controller.personalizeProtocol.bind(controller)
);

router.put(
    "/regimen-protocols/personalized/:protocolId",
    authenticate,
    authorize("chemo.protocol.manage"),
    updatePersonalizedProtocolValidation,
    controller.updatePersonalizedProtocol.bind(controller)
);

router.post(
    "/regimen-protocols/personalized/:protocolId/items",
    authenticate,
    authorize("chemo.protocol.manage"),
    addPersonalizedProtocolItemValidation,
    controller.addPersonalizedProtocolItem.bind(controller)
);

router.put(
    "/regimen-protocols/personalized/:protocolId/items/:protocolItemId",
    authenticate,
    authorize("chemo.protocol.manage"),
    updatePersonalizedProtocolItemValidation,
    controller.updatePersonalizedProtocolItem.bind(controller)
);

router.delete(
    "/regimen-protocols/personalized/:protocolId/items/:protocolItemId",
    authenticate,
    authorize("chemo.protocol.manage"),
    removePersonalizedProtocolItemValidation,
    controller.removePersonalizedProtocolItem.bind(controller)
);

router.post(
    "/regimen-protocols/personalized/:protocolId/days",
    authenticate,
    authorize("chemo.protocol.manage"),
    addPersonalizedProtocolDayValidation,
    controller.addPersonalizedProtocolDay.bind(controller)
);

router.put(
    "/regimen-protocols/personalized/:protocolId/days/:protocolDayId",
    authenticate,
    authorize("chemo.protocol.manage"),
    updatePersonalizedProtocolDayValidation,
    controller.updatePersonalizedProtocolDay.bind(controller)
);

router.delete(
    "/regimen-protocols/personalized/:protocolId/days/:protocolDayId",
    authenticate,
    authorize("chemo.protocol.manage"),
    removePersonalizedProtocolDayValidation,
    controller.removePersonalizedProtocolDay.bind(controller)
);

router.post(
    "/regimen-protocols/personalized/:protocolId/items/:protocolItemId/dilutions",
    authenticate,
    authorize("chemo.protocol.manage"),
    addPersonalizedProtocolDilutionValidation,
    controller.addPersonalizedProtocolDilution.bind(controller)
);

router.put(
    "/regimen-protocols/personalized/:protocolId/items/:protocolItemId/dilutions/:protocolDilutionId",
    authenticate,
    authorize("chemo.protocol.manage"),
    updatePersonalizedProtocolDilutionValidation,
    controller.updatePersonalizedProtocolDilution.bind(controller)
);

router.delete(
    "/regimen-protocols/personalized/:protocolId/items/:protocolItemId/dilutions/:protocolDilutionId",
    authenticate,
    authorize("chemo.protocol.manage"),
    removePersonalizedProtocolDilutionValidation,
    controller.removePersonalizedProtocolDilution.bind(controller)
);

router.post(
    "/regimen-protocols/personalized/:protocolId/activate",
    authenticate,
    authorize("chemo.protocol.manage"),
    getRegimenProtocolValidation,
    controller.activatePersonalizedProtocol.bind(controller)
);

router.post(
    "/regimen-protocols/personalized/:protocolId/version",
    authenticate,
    authorize("chemo.protocol.manage"),
    createPersonalizedProtocolVersionValidation,
    controller.createPersonalizedProtocolVersion.bind(controller)
);

router.get(
    "/regimen-protocols/:protocolId/discharge-medicines",
    authenticate,
    authorize("chemo.protocol.read"),
    getRegimenProtocolValidation,
    controller.getDischargeMedicinesForProtocol.bind(controller)
);

router.get(
    "/regimen-protocols/:protocolId",
    authenticate,
    authorize("chemo.protocol.read"),
    getRegimenProtocolValidation,
    controller.getRegimenProtocol.bind(controller)
);

router.get(
    "/regimen-protocols/:protocolId/discharge-medicines",
    authenticate,
    authorize("chemo.protocol.read"),
    getRegimenProtocolValidation,
    controller.getDischargeMedicinesForProtocol.bind(controller)
);

router.get(
    "/medicines",
    authenticate,
    authorize("chemo.protocol.read"),
    controller.listAllActiveMedicines.bind(controller)
);

router.get(
    "/medicines/dilution-medicines",
    authenticate,
    authorize("chemo.protocol.read"),
    controller.listDilutionMedicines.bind(controller)
);

router.get(
    "/medicines/by-cancer-subtype",
    authenticate,
    authorize("chemo.protocol.read"),
    controller.getMedicinesByCancerTypeAndSubtype.bind(controller)
);

router.get(
    "/medicines/by-role",
    authenticate,
    authorize("chemo.protocol.read"),
    controller.listMedicinesByDrugRole.bind(controller)
);

router.get(
    "/protocol-field-options",
    authenticate,
    authorize("chemo.protocol.read"),
    controller.getProtocolFieldOptions.bind(controller)
);

router.post(
    "/regimen-protocols",
    authenticate,
    authorize("chemo.protocol.manage"),
    createRegimenProtocolValidation,
    controller.createRegimenProtocol.bind(controller)
);

router.put(
    "/regimen-protocols/:protocolId",
    authenticate,
    authorize("chemo.protocol.manage"),
    updateRegimenProtocolValidation,
    controller.updateRegimenProtocol.bind(controller)
);

router.post(
    "/regimen-protocols/:protocolId/items",
    authenticate,
    authorize("chemo.protocol.manage"),
    addRegimenProtocolItemValidation,
    controller.addRegimenProtocolItem.bind(controller)
);

router.put(
    "/regimen-protocols/:protocolId/items/:protocolItemId",
    authenticate,
    authorize("chemo.protocol.manage"),
    updateRegimenProtocolItemValidation,
    controller.updateRegimenProtocolItem.bind(controller)
);

router.delete(
    "/regimen-protocols/:protocolId/items/:protocolItemId",
    authenticate,
    authorize("chemo.protocol.manage"),
    controller.removeRegimenProtocolItem.bind(controller)
);

router.post(
    "/regimen-protocols/:protocolId/discharge-instructions",
    authenticate,
    authorize("chemo.protocol.manage"),
    addDischargeInstructionValidation,
    controller.addDischargeInstruction.bind(controller)
);

router.put(
    "/regimen-protocols/:protocolId/discharge-instructions/:dischargeInstructionId",
    authenticate,
    authorize("chemo.protocol.manage"),
    updateDischargeInstructionValidation,
    controller.updateDischargeInstruction.bind(controller)
);

router.delete(
    "/regimen-protocols/:protocolId/discharge-instructions/:dischargeInstructionId",
    authenticate,
    authorize("chemo.protocol.manage"),
    removeDischargeInstructionValidation,
    controller.removeDischargeInstruction.bind(controller)
);

// ---------------- Plan ----------------

router.get(
    "/plans/preview",
    authenticate,
    authorize("chemo.plan.read"),
    previewPlanValidation,
    controller.previewPlan.bind(controller)
);

router.post(
    "/plans",
    authenticate,
    authorize("chemo.plan.create"),
    createPlanValidation,
    controller.createPlan.bind(controller)
);

router.get(
    "/plans",
    authenticate,
    authorize("chemo.plan.read"),
    listPlansValidation,
    controller.listPlans.bind(controller)
);

router.get(
    "/plans/latest-for-patient",
    authenticate,
    authorize("chemo.plan.read"),
    controller.getLatestPlanForPatient.bind(controller)
);

router.get(
    "/plans/:planId",
    authenticate,
    authorize("chemo.plan.read"),
    planIdParamValidation,
    controller.getPlan.bind(controller)
);

router.put(
    "/plans/:planId",
    authenticate,
    authorize("chemo.plan.update"),
    updatePlanValidation,
    controller.updatePlan.bind(controller)
);

router.patch(
    "/plans/:planId/status",
    authenticate,
    authorize("chemo.plan.update"),
    planStatusValidation,
    controller.changePlanStatus.bind(controller)
);

// ---------------- Plan items ----------------

router.post(
    "/plans/:planId/items",
    authenticate,
    authorize("chemo.plan.update"),
    addPlanItemValidation,
    controller.addPlanItem.bind(controller)
);

router.put(
    "/plans/:planId/items/:planItemId",
    authenticate,
    authorize("chemo.plan.update"),
    updatePlanItemValidation,
    controller.updatePlanItem.bind(controller)
);

router.delete(
    "/plans/:planId/items/:planItemId",
    authenticate,
    authorize("chemo.plan.update"),
    controller.removePlanItem.bind(controller)
);

// ---------------- Cycles ----------------

router.post(
    "/plans/:planId/cycles",
    authenticate,
    authorize("chemo.cycle.manage"),
    createCycleValidation,
    controller.createCycle.bind(controller)
);

router.get(
    "/plans/:planId/cycles",
    authenticate,
    authorize("chemo.plan.read"),
    planIdParamValidation,
    controller.listCyclesForPlan.bind(controller)
);

router.get(
    "/cycles/:cycleId",
    authenticate,
    authorize("chemo.plan.read"),
    cycleIdParamValidation,
    controller.getCycle.bind(controller)
);

router.put(
    "/cycles/:cycleId",
    authenticate,
    authorize("chemo.cycle.manage"),
    updateCycleValidation,
    controller.updateCycle.bind(controller)
);

router.patch(
    "/cycles/:cycleId/status",
    authenticate,
    authorize("chemo.cycle.manage"),
    cycleStatusValidation,
    controller.changeCycleStatus.bind(controller)
);

// ---------------- Administration ----------------

router.post(
    "/cycles/:cycleId/administration",
    authenticate,
    authorize("chemo.administration.record"),
    recordAdministrationValidation,
    controller.recordAdministration.bind(controller)
);

router.get(
    "/cycles/:cycleId/administration",
    authenticate,
    authorize("chemo.plan.read"),
    cycleIdParamValidation,
    controller.listAdministrations.bind(controller)
);

// ---------------- Vitals ----------------

router.post(
    "/cycles/:cycleId/vitals",
    authenticate,
    authorize("chemo.vitals.record"),
    recordVitalsValidation,
    controller.recordVitals.bind(controller)
);

router.get(
    "/cycles/:cycleId/vitals",
    authenticate,
    authorize("chemo.plan.read"),
    cycleIdParamValidation,
    controller.listVitals.bind(controller)
);

// ---------------- Adverse events ----------------

router.post(
    "/cycles/:cycleId/adverse-events",
    authenticate,
    authorize("chemo.adverse_event.record"),
    recordAdverseEventValidation,
    controller.recordAdverseEvent.bind(controller)
);

router.get(
    "/cycles/:cycleId/adverse-events",
    authenticate,
    authorize("chemo.plan.read"),
    cycleIdParamValidation,
    controller.listAdverseEvents.bind(controller)
);

// ---------------- Lab review ----------------

router.post(
    "/cycles/:cycleId/lab-review",
    authenticate,
    authorize("chemo.lab_review.record"),
    recordLabReviewValidation,
    controller.recordLabReview.bind(controller)
);

router.get(
    "/cycles/:cycleId/lab-review",
    authenticate,
    authorize("chemo.plan.read"),
    cycleIdParamValidation,
    controller.listLabReviews.bind(controller)
);

// ---------------- Followup ----------------

router.post(
    "/cycles/:cycleId/followup",
    authenticate,
    authorize("chemo.followup.record"),
    recordFollowupValidation,
    controller.recordFollowup.bind(controller)
);

router.get(
    "/cycles/:cycleId/followup",
    authenticate,
    authorize("chemo.plan.read"),
    cycleIdParamValidation,
    controller.listFollowups.bind(controller)
);



export default router;
