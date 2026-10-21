"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const followup_controller_1 = require("./followup.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
const controller = new followup_controller_1.FollowupController();
// Follow-up due alerts of the signed-in user's branches (all branches for
// Head / Super Admin). The role and branches come from the login.
router.get("/alerts", auth_middleware_1.authenticate, controller.listAlerts.bind(controller));
router.put("/alerts/read", auth_middleware_1.authenticate, controller.markRead.bind(controller));
router.put("/alerts/:encounterNo/dismiss", auth_middleware_1.authenticate, controller.dismiss.bind(controller));
exports.default = router;
