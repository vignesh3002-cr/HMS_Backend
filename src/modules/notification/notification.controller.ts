import { Request, Response } from "express";
import { NotificationService } from "./notification.service";

const service = new NotificationService();

export class NotificationController {

    async getNotifications(req: Request, res: Response) {

        try {

            const employeeId =
                req.query.employeeId as string;

            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    message: "employeeId query parameter is required"
                });
            }

            const data =
                await service.getNotifications(employeeId);

            return res.json({
                success: true,
                message: "Notifications fetched successfully",
                data
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async markAllRead(req: Request, res: Response) {

        try {

            const employeeId =
                req.query.employeeId as string;

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

        } catch (error: any) {

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
    async sendEmail(req: Request, res: Response) {

        try {

            const data = await service.sendEmail(req.body ?? {});

            return res.json({
                success: true,
                message: "Email sent successfully",
                data
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message || "Failed to send email"
            });

        }

    }

    async getLabNotifications(req: Request, res: Response) {
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
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async markAllLabRead(req: Request, res: Response) {
        return res.json({
            success: true,
            message: "All lab notifications marked as read"
        });
    }
}
