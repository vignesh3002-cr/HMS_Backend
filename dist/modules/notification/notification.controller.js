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
}
exports.NotificationController = NotificationController;
