"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const notification_repository_1 = require("./notification.repository");
const repository = new notification_repository_1.NotificationRepository();
class NotificationService {
    async getNotifications(employeeId) {
        return repository.getNotifications(employeeId);
    }
    async markAllRead(employeeId) {
        return repository.markAllRead(employeeId);
    }
}
exports.NotificationService = NotificationService;
