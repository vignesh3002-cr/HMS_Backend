"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("./notification.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
const controller = new notification_controller_1.NotificationController();
// In-app notifications for a doctor (bookings + check-ins)
router.get("/", auth_middleware_1.authenticate, controller.getNotifications.bind(controller));
// Mark all of the doctor's in-app notifications as read
router.put("/read-all", auth_middleware_1.authenticate, controller.markAllRead.bind(controller));
exports.default = router;
