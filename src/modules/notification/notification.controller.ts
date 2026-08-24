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

}
