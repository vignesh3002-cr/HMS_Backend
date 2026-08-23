"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const NOTIFICATION_TYPES = ["BOOKING", "CHECKIN"];
const NOTIFICATION_SELECT = {
    notification_id: true,
    appointment_id: true,
    channel: true,
    notification_type: true,
    recipient: true,
    status: true,
    created_at: true,
    appointment_history: {
        select: {
            appointment_date: true,
            appointment_time: true,
            status: true,
            patient_bio_data: {
                select: {
                    patient_first_name: true,
                    patient_middle_name: true,
                    patient_last_name: true
                }
            }
        }
    }
};
class NotificationRepository {
    async getNotifications(employeeId) {
        const where = {
            recipient: employeeId,
            notification_type: {
                in: NOTIFICATION_TYPES
            }
        };
        const [notifications, unreadCount] = await Promise.all([
            prisma_1.default.appointment_notification.findMany({
                where,
                orderBy: {
                    created_at: "desc"
                },
                take: 20,
                select: NOTIFICATION_SELECT
            }),
            prisma_1.default.appointment_notification.count({
                where: {
                    ...where,
                    status: "UNREAD"
                }
            })
        ]);
        return { notifications, unreadCount };
    }
    async markAllRead(employeeId) {
        const result = await prisma_1.default.appointment_notification.updateMany({
            where: {
                recipient: employeeId,
                notification_type: {
                    in: NOTIFICATION_TYPES
                },
                status: "UNREAD"
            },
            data: {
                status: "READ"
            }
        });
        return { updated: result.count };
    }
}
exports.NotificationRepository = NotificationRepository;
