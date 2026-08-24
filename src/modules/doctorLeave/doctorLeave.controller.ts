import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { DoctorLeaveService } from "./doctorLeave.service";
import {
    LEAVE_DEFAULT_PAGE,
    LEAVE_DEFAULT_LIMIT
} from "./doctorLeave.constants";

export class DoctorLeaveController {

    private service = new DoctorLeaveService();

    applyLeave = async (req: Request, res: Response) => {

        try {

            const employeeId = String(req.params.employeeId);

            // Get the logged-in user from the JWT.
            // Do NOT trust requested_by from the frontend.
            const authUser = (req as any).user;

            if (!authUser?.user_id) {
                return res.status(401).json({
                    success: false,
                    message: "Authenticated user not found"
                });
            }

            const requestedBy = String(authUser.user_id);
            const role = String(authUser.role ?? "").toUpperCase();

            console.log("employeeId =", employeeId);
            console.log("requestedBy =", requestedBy);
            console.log("role =", role);

            const result = await this.service.applyLeave(
                employeeId,
                req.body,
                requestedBy,
                role
            );

            return res.status(201).json({
                success: true,
                ...result
            });

        } catch (error: any) {

            console.error(error);

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    };


    approveLeave = async (req: Request, res: Response) => {

        try {

            const leaveId = String(req.params.leaveId);

            const authUser = (req as any).user;

            if (!authUser?.user_id) {
                return res.status(401).json({
                    success: false,
                    message: "Authenticated user not found"
                });
            }

            // Use the logged-in user's ID.
            // Do NOT trust approved_by from the frontend.
            const approvedBy = String(authUser.user_id);

            console.log("leaveId =", leaveId);
            console.log("approvedBy =", approvedBy);

            const result = await this.service.approveLeave(
                leaveId,
                req.body,
                approvedBy
            );

            return res.json({
                success: true,
                ...result
            });

        } catch (error: any) {

            console.error(error);

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    };


    rejectLeave = async (req: Request, res: Response) => {

        try {

            const leaveId = String(req.params.leaveId);

            const authUser = (req as any).user;

            if (!authUser?.user_id) {
                return res.status(401).json({
                    success: false,
                    message: "Authenticated user not found"
                });
            }

            // Use logged-in user's ID.
            const rejectedBy = String(authUser.user_id);

            console.log("leaveId =", leaveId);
            console.log("rejectedBy =", rejectedBy);

            const result = await this.service.rejectLeave(
                leaveId,
                req.body,
                rejectedBy
            );

            return res.json({
                success: true,
                ...result
            });

        } catch (error: any) {

            console.error(error);

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    };


    getDoctorLeaves = async (req: Request, res: Response) => {

        try {

            const result = await this.service.getDoctorLeaves({
                employee_id: req.query.employee_id as string,
                status: req.query.status as any,
                page: req.query.page
                    ? Number(req.query.page)
                    : LEAVE_DEFAULT_PAGE,
                limit: req.query.limit
                    ? Number(req.query.limit)
                    : LEAVE_DEFAULT_LIMIT
            });

            return res.json(result);

        } catch (error: any) {

            console.error(error);

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    };


    queueRescheduleForLeave = async (req: Request, res: Response) => {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const employeeId =
                String(req.params.employeeId);

            const authUser = (req as any).user;
            const createdBy = String(authUser?.user_id ?? "SYSTEM");

            const summary =
                await this.service.queueRescheduleForLeave(
                    employeeId,
                    {
                        date_from: req.body.date_from,
                        date_to: req.body.date_to,
                        reason: req.body.reason,
                        priority: req.body.priority
                    },
                    createdBy
                );

            return res.json({
                success: true,
                message: `${summary.queued} appointment(s) added to the reschedule queue`,
                data: summary
            });

        } catch (error: any) {

            console.error(error);

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    };


    getLeaveConflicts = async (req: Request, res: Response) => {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const employeeId =
                String(req.params.employeeId);

            const conflicts =
                await this.service.getLeaveConflicts(
                    employeeId,
                    {
                        date_from: req.query.date_from as string,
                        date_to: req.query.date_to as string
                    }
                );

            return res.json({
                success: true,
                message: "Conflicting appointments fetched successfully",
                data: conflicts
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    };

}