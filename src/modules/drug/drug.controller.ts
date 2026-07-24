import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { DrugService } from "./drug.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new DrugService();

export class DrugController {

    async createDrug(req: AuthRequest, res: Response) {

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

            const record = await service.createDrug(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "DRUG_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Drug created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getDrugs(req: AuthRequest, res: Response) {

        try {

            const result = await service.getDrugs({

                search: req.query.search as string,

                drugClass: req.query.drugClass as string,

                vesicantStatus: req.query.vesicantStatus as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Drugs fetched successfully",
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

    async getDrugById(req: AuthRequest, res: Response) {

        try {
            const record = await service.getDrugById(
                req.params.drugId as string
            );

            return res.status(200).json({
                success: true,
                message: "Drug fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateDrug(req: AuthRequest, res: Response) {

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

            const record = await service.updateDrug(
               req.params["drugId"] as string,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "DRUG_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Drug updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteDrug(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deleteDrug(
                req.params["drugId"] as string,
                updatedBy
            );
            await recordAuditLog({
                username: req.user?.username,
                moduleName: "DRUG_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Drug deleted successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreDrug(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restoreDrug(
                req.params["drugId"] as string,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "DRUG_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Drug restored successfully",
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
