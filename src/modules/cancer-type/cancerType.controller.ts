import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { CancerTypeService } from "./cancerType.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new CancerTypeService();

export class CancerTypeController {

    async createCancerType(req: AuthRequest, res: Response) {

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

            const cancerType = await service.createCancerType(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CANCER_TYPE_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Cancer type created successfully",
                data: cancerType
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getCancerTypes(req: AuthRequest, res: Response) {

        try {

            const result = await service.getCancerTypes({

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
                message: "Cancer types fetched successfully",
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

    async getCancerTypeById(req: AuthRequest, res: Response) {

        try {

            const cancerType = await service.getCancerTypeById(
                req.params.cancerTypeId as string
            );

            return res.status(200).json({
                success: true,
                message: "Cancer type fetched successfully",
                data: cancerType
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateCancerType(req: AuthRequest, res: Response) {

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

            const cancerType = await service.updateCancerType(
                req.params.cancerTypeId as string,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CANCER_TYPE_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Cancer type updated successfully",
                data: cancerType
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteCancerType(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const cancerType = await service.deleteCancerType(
                req.params.cancerTypeId as string,  
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CANCER_TYPE_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Cancer type deleted successfully",
                data: cancerType
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreCancerType(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const cancerType = await service.restoreCancerType(
                req.params.cancerTypeId as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CANCER_TYPE_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Cancer type restored successfully",
                data: cancerType
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}
