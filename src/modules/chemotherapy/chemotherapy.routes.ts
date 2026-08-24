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
    addRegimenProtocolItemValidation
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

router.get(
    "/regimen-protocols/:protocolId",
    authenticate,
    authorize("chemo.protocol.read"),
    getRegimenProtocolValidation,
    controller.getRegimenProtocol.bind(controller)
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

router.delete(
    "/regimen-protocols/:protocolId/items/:protocolItemId",
    authenticate,
    authorize("chemo.protocol.manage"),
    controller.removeRegimenProtocolItem.bind(controller)
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
