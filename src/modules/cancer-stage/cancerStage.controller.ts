import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { CancerStageService } from "./cancerStage.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new CancerStageService();

export class CancerStageController {

    async createCancerStage(req: AuthRequest, res: Response) {

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

            const stage = await service.createCancerStage(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CANCER_STAGE_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Cancer stage created successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getCancerStages(req: AuthRequest, res: Response) {

        try {

            const result = await service.getCancerStages({

                search: req.query.search as string,

                stageGroup: req.query.stageGroup as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Cancer stages fetched successfully",
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

    async getCancerStageById(req: AuthRequest, res: Response) {

        try {

            const stage = await service.getCancerStageById(
                req.params["cancerStageId"] as string
            );


            return res.status(200).json({
                success: true,
                message: "Cancer stage fetched successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateCancerStage(req: AuthRequest, res: Response) {

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

            const stage = await service.updateCancerStage(
                req.params["cancerStageId"] as string,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CANCER_STAGE_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Cancer stage updated successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteCancerStage(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const stage = await service.deleteCancerStage(
                req.params["cancerStageId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CANCER_STAGE_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Cancer stage deleted successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreCancerStage(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const stage = await service.restoreCancerStage(
                req.params["cancerStageId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CANCER_STAGE_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Cancer stage restored successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}
