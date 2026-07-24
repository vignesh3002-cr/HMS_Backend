import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { TreatmentPlanService } from "./treatmentPlan.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new TreatmentPlanService();

export class TreatmentPlanController {

    async createTreatmentPlan(req: AuthRequest, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const createdBy = req.user?.username || "SYSTEM";

            const record = await service.createTreatmentPlan(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                branchId: req.body.branch_id,
                moduleName: "TREATMENT_PLAN",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Treatment plan created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getTreatmentPlans(req: AuthRequest, res: Response) {

        try {

            const result = await service.getTreatmentPlans({

                patientId: req.query.patientId as string,

                diagnosisId: req.query.diagnosisId as string,

                protocolId: req.query.protocolId as string,

                planStatus: req.query.planStatus as string,

                branchId: req.query.branchId as string,

                doctorId: req.query.doctorId as string,

                isActive: req.query.isActive as string,

                search: req.query.search as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Treatment plans fetched successfully",
                data: result.records,
                pagination: result.pagination
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async getTreatmentPlanById(req: AuthRequest, res: Response) {

        try {

            const record = await service.getTreatmentPlanById(
                req.params.treatmentPlanId
            );

            return res.status(200).json({
                success: true,
                message: "Treatment plan fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateTreatmentPlan(req: AuthRequest, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.updateTreatmentPlan(
                req.params.treatmentPlanId,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TREATMENT_PLAN",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Treatment plan updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async approveTreatmentPlan(req: AuthRequest, res: Response) {

        try {

            const approvedBy = req.user?.username || "SYSTEM";

            const record = await service.approveTreatmentPlan(
                req.params.treatmentPlanId,
                approvedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TREATMENT_PLAN",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Treatment plan approved successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteTreatmentPlan(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deleteTreatmentPlan(
                req.params.treatmentPlanId,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TREATMENT_PLAN",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Treatment plan cancelled successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreTreatmentPlan(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restoreTreatmentPlan(
                req.params.treatmentPlanId,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TREATMENT_PLAN",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Treatment plan restored successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}
