import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { HistomorphologyService } from "./histomorphology.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new HistomorphologyService();

export class HistomorphologyController {

    async createHistomorphology(req: AuthRequest, res: Response) {

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

            const record = await service.createHistomorphology(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "HISTOMORPHOLOGY_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Histomorphology created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getHistomorphologies(req: AuthRequest, res: Response) {

        try {

            const result = await service.getHistomorphologies({

                search: req.query.search as string,

                behavior: req.query.behavior as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Histomorphologies fetched successfully",
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

    async getHistomorphologyById(req: AuthRequest, res: Response) {

        try {

            const record = await service.getHistomorphologyById(
                req.params["histomorphologyId"] as string);

            return res.status(200).json({
                success: true,
                message: "Histomorphology fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateHistomorphology(req: AuthRequest, res: Response) {

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

            const record = await service.updateHistomorphology(
                req.params["histomorphologyId"] as string,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "HISTOMORPHOLOGY_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Histomorphology updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteHistomorphology(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deleteHistomorphology(
                req.params["histomorphologyId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "HISTOMORPHOLOGY_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Histomorphology deleted successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreHistomorphology(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restoreHistomorphology(
                req.params["histomorphologyId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "HISTOMORPHOLOGY_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Histomorphology restored successfully",
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
