import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { TnmStageService } from "./tnmStage.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new TnmStageService();

export class TnmStageController {

    async createTnmStage(req: AuthRequest, res: Response) {

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

            const stage = await service.createTnmStage(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TNM_STAGE_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "TNM stage created successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getTnmStages(req: AuthRequest, res: Response) {

        try {

            const result = await service.getTnmStages({

                search: req.query.search as string,

                cancerTypeId: req.query.cancerTypeId as string,

                overallStageGroup: req.query.overallStageGroup as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "TNM stages fetched successfully",
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

    async getTnmStageById(req: AuthRequest, res: Response) {

        try {

            const stage = await service.getTnmStageById(
                req.params["tnmStageId"] as string
            );

            return res.status(200).json({
                success: true,
                message: "TNM stage fetched successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateTnmStage(req: AuthRequest, res: Response) {

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

            const stage = await service.updateTnmStage(
                req.params["tnmStageId"] as string,
                req.body,
                updatedBy
            );

            await recordAuditLog({  
                username: req.user?.username,
                moduleName: "TNM_STAGE_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "TNM stage updated successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteTnmStage(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const stage = await service.deleteTnmStage(
                req.params["tnmStageId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TNM_STAGE_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "TNM stage deleted successfully",
                data: stage
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreTnmStage(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const stage = await service.restoreTnmStage(
                req.params["tnmStageId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TNM_STAGE_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "TNM stage restored successfully",
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
