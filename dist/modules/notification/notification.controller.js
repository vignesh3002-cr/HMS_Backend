"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const notification_service_1 = require("./notification.service");
const service = new notification_service_1.NotificationService();
class NotificationController {
    async getNotifications(req, res) {
        try {
            const employeeId = req.query.employeeId;
            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    message: "employeeId query parameter is required"
                });
            }
            const data = await service.getNotifications(employeeId);
            return res.json({
                success: true,
                message: "Notifications fetched successfully",
                data
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async markAllRead(req, res) {
        try {
            const employeeId = req.query.employeeId;
            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    message: "employeeId query parameter is required"
                });
            }
            const data = await service.markAllRead(employeeId);
            return res.json({
                success: true,
                message: "Notifications marked as read",
                data
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    /**
     * POST /api/notifications/send-email
     * Sends an email directly over SMTP — the browser never opens a mail
     * app. Returns 400 with the real reason when validation or SMTP fails
     * so the caller can decide whether to continue (e.g. block patient
     * registration when the confirmation could not be sent).
     */
    async sendEmail(req, res) {
        try {
            const data = await service.sendEmail(req.body ?? {});
            return res.json({
                success: true,
                message: "Email sent successfully",
                data
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || "Failed to send email"
            });
        }
    }
    async getLabNotifications(req, res) {
        try {
            return res.json({
                success: true,
                message: "Lab notifications fetched successfully",
                data: {
                    notifications: [],
                    total: 0,
                    unreadCount: 0,
                    statCount: 0
                }
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    async markAllLabRead(req, res) {
        return res.json({
            success: true,
            message: "All lab notifications marked as read"
        });
    }
}
exports.NotificationController = NotificationController;
