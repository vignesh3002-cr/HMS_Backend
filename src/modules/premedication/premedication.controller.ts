import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { PremedicationService } from "./premedication.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new PremedicationService();

export class PremedicationController {

    async createPremedication(req: AuthRequest, res: Response) {

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

            const record = await service.createPremedication(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "PREMEDICATION_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Premedication created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getPremedications(req: AuthRequest, res: Response) {

        try {

            const result = await service.getPremedications({

                search: req.query.search as string,

                category: req.query.category as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Premedications fetched successfully",
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

    async getPremedicationById(req: AuthRequest, res: Response) {

        try {

            const record = await service.getPremedicationById(
                req.params["premedicationId"] as string
            );

            return res.status(200).json({
                success: true,
                message: "Premedication fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updatePremedication(req: AuthRequest, res: Response) {

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

            const record = await service.updatePremedication(
                req.params["premedicationId"] as string,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "PREMEDICATION_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Premedication updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deletePremedication(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deletePremedication(
                req.params["premedicationId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "PREMEDICATION_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Premedication deleted successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restorePremedication(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restorePremedication(
                req.params["premedicationId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "PREMEDICATION_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Premedication restored successfully",
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
