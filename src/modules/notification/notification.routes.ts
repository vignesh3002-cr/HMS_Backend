import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();

const controller = new NotificationController();

// Lab notifications (stat alerts & sample status)
router.get("/lab", controller.getLabNotifications.bind(controller));
router.put("/lab/read-all", controller.markAllLabRead.bind(controller));


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

// Sends an email directly over SMTP (no mail app opens on the client)
router.post(
    "/send-email",
    authenticate,
    controller.sendEmail.bind(controller)
);

export default router;
