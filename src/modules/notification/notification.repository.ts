import prisma from "../../config/prisma";

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

export class NotificationRepository {

    async getNotifications(employeeId: string) {

        const where = {
            recipient: employeeId,
            notification_type: {
                in: NOTIFICATION_TYPES
            }
        };

        const [notifications, unreadCount] =
            await Promise.all([

                prisma.appointment_notification.findMany({
                    where,
                    orderBy: {
                        created_at: "desc"
                    },
                    take: 20,
                    select: NOTIFICATION_SELECT
                }),

                prisma.appointment_notification.count({
                    where: {
                        ...where,
                        status: "UNREAD"
                    }
                })

            ]);

        return { notifications, unreadCount };

    }

    async markAllRead(employeeId: string) {

        const result =
            await prisma.appointment_notification.updateMany({
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
