"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const priorityFlags_controller_1 = require("./priorityFlags.controller");
const router = (0, express_1.Router)();
const controller = new priorityFlags_controller_1.PriorityFlagsController();
router.get("/", auth_middleware_1.authenticate, controller.getPriorityFlags.bind(controller));
exports.default = router;
