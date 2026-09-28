"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_chat_controller_1 = require("./ai-chat.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
const controller = new ai_chat_controller_1.AIChatController();
router.post("/", auth_middleware_1.authenticate, controller.chat.bind(controller));
exports.default = router;
