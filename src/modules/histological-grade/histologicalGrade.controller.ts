import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { HistologicalGradeService } from "./histologicalGrade.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new HistologicalGradeService();

export class HistologicalGradeController {

    async createHistologicalGrade(req: AuthRequest, res: Response) {

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

            const record = await service.createHistologicalGrade(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "HISTOLOGICAL_GRADE_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Histological grade created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getHistologicalGrades(req: AuthRequest, res: Response) {

        try {

            const result = await service.getHistologicalGrades({

                search: req.query.search as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Histological grades fetched successfully",
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

    async getHistologicalGradeById(req: AuthRequest, res: Response) {

        try {

            const record = await service.getHistologicalGradeById(
                req.params["histologicalGradeId"] as string
            );

            return res.status(200).json({
                success: true,
                message: "Histological grade fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateHistologicalGrade(req: AuthRequest, res: Response) {

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

            const record = await service.updateHistologicalGrade(
                req.params["histologicalGradeId"] as string,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "HISTOLOGICAL_GRADE_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Histological grade updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteHistologicalGrade(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deleteHistologicalGrade(
                req.params["histologicalGradeId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "HISTOLOGICAL_GRADE_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Histological grade deleted successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreHistologicalGrade(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restoreHistologicalGrade(
                req.params["histologicalGradeId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "HISTOLOGICAL_GRADE_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Histological grade restored successfully",
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
