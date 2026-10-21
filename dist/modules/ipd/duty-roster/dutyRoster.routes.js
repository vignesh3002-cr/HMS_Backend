"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../auth/auth.middleware");
const authorize_1 = require("../../../middleware/authorize");
const dutyRoster_controller_1 = require("./dutyRoster.controller");
const router = (0, express_1.Router)();
const controller = new dutyRoster_controller_1.DutyRosterController();
// -------------------------------------------------------------
// Availability Query (Used by Allocate Care Team dialog)
// -------------------------------------------------------------
router.get("/available", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("admission.read", "ipd.duty_roster", "admission.care_team"), controller.getAvailableStaff.bind(controller));
// -------------------------------------------------------------
// Branch Shift Configurations
// -------------------------------------------------------------
router.get("/branch-shifts", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("admission.read", "ipd.duty_roster"), controller.getBranchShifts.bind(controller));
router.post("/branch-shifts", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), controller.createBranchShift.bind(controller));
router.patch("/branch-shifts/:shiftId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), controller.updateBranchShift.bind(controller));
// -------------------------------------------------------------
// Weekly Recurring Templates
// -------------------------------------------------------------
router.get("/templates", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("admission.read", "ipd.duty_roster"), controller.getTemplates.bind(controller));
router.post("/templates", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), controller.upsertTemplate.bind(controller));
router.delete("/templates/:templateId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), controller.deleteTemplate.bind(controller));
// -------------------------------------------------------------
// Date-specific Duty Roster Entries
// -------------------------------------------------------------
router.get("/roster", auth_middleware_1.authenticate, (0, authorize_1.authorizeAny)("admission.read", "ipd.duty_roster"), controller.getRoster.bind(controller));
router.post("/roster", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), controller.upsertRosterEntry.bind(controller));
router.delete("/roster/:rosterId", auth_middleware_1.authenticate, (0, authorize_1.authorize)("ipd.duty_roster"), controller.deleteRosterEntry.bind(controller));
exports.default = router;
