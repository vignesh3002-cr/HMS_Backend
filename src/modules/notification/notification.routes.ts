import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();

const controller = new NotificationController();

// In-app notifications for a doctor (bookings + check-ins)
router.get(
    "/",
    authenticate,
    controller.getNotifications.bind(controller)
);

// Mark all of the doctor's in-app notifications as read
router.put(
    "/read-all",
    authenticate,
    controller.markAllRead.bind(controller)
);

export default router;
