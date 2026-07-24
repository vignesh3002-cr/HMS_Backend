import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { IcdCodeService } from "./icdCode.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new IcdCodeService();

export class IcdCodeController {

    async createIcdCode(req: AuthRequest, res: Response) {

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

            const record = await service.createIcdCode(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "ICD_CODE_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "ICD code created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getIcdCodes(req: AuthRequest, res: Response) {

        try {

            const result = await service.getIcdCodes({

                search: req.query.search as string,

                icdVersion: req.query.icdVersion as string,

                category: req.query.category as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "ICD codes fetched successfully",
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

    async getIcdCodeById(req: AuthRequest, res: Response) {

        try {

            const record = await service.getIcdCodeById(
                req.params["icdCodeId"] as string
            );

            return res.status(200).json({
                success: true,
                message: "ICD code fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateIcdCode(req: AuthRequest, res: Response) {

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

            const record = await service.updateIcdCode(
                req.params["icdCodeId"] as string,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "ICD_CODE_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "ICD code updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteIcdCode(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deleteIcdCode(
                req.params["icdCodeId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "ICD_CODE_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "ICD code deleted successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreIcdCode(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restoreIcdCode(
                req.params["icdCodeId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "ICD_CODE_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "ICD code restored successfully",
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
