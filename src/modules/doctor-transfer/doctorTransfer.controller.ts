import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { DoctorTransferService } from "./doctorTransfer.service";

const service = new DoctorTransferService();

function actingUserId(req: Request): string {
    return (req as any).user?.user_id || "SYSTEM";
}

export class DoctorTransferController {

    async initiateTransfer(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const bypassHeader = (req.headers['x-bypass-pending-transfer'] || '').toString().toLowerCase();
            const bypassPending = bypassHeader === 'true';
            const authUser = (req as any).user || {};
            const isAdmin = ['HEAD_ADMIN','SUPER_ADMIN','BRANCH_ADMIN'].includes(authUser.role_type?.toUpperCase());

            const result = await service.initiateTransfer(
                req.params.employeeId as string,
                req.body,
                actingUserId(req),
                bypassPending && isAdmin
            );

            return res.status(201).json({
                success: true,
                message: result.message,
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async confirmTransfer(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const result = await service.confirmTransfer(
                req.params.employeeId as string,
                req.body,
                actingUserId(req)
            );

            return res.json({
                success: true,
                message: `Transfer ${result.action} action completed successfully`,
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getFutureAppointments(req: Request, res: Response) {

        try {

            const result = await service.previewFutureAppointments(
                req.params.employeeId as string,
                req.query.effective_date as string | undefined
            );

            return res.json({
                success: true,
                message: "Future appointments fetched successfully",
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async transferPreview(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const result = await service.previewFutureAppointments(
                req.body.employee_id,
                req.body.effective_date
            );

            return res.json({
                success: true,
                message: "Transfer preview generated successfully",
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getRescheduleQueue(req: Request, res: Response) {

        try {

            const result = await service.getRescheduleQueue({
                branchId: req.query.branchId as string,
                patientId: req.query.patientId as string,
                status: req.query.status as string,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10)
            });

            return res.json({
                success: true,
                message: "Reschedule queue fetched successfully",
                data: result
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async processRescheduleAction(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const result = await service.processRescheduleQueueAction(
                req.params.appointmentId as string,
                req.body,
                actingUserId(req)
            );

            return res.json({
                success: true,
                message: `Reschedule request ${result.status.toLowerCase()} successfully`,
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}
