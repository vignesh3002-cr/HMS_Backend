import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { TreatmentIntentService } from "./treatmentIntent.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new TreatmentIntentService();

export class TreatmentIntentController {

    async createTreatmentIntent(req: AuthRequest, res: Response) {

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

            const record = await service.createTreatmentIntent(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TREATMENT_INTENT_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Treatment intent created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getTreatmentIntents(req: AuthRequest, res: Response) {

        try {

            const result = await service.getTreatmentIntents({

                search: req.query.search as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Treatment intents fetched successfully",
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

    async getTreatmentIntentById(req: AuthRequest, res: Response) {

        try {

            const record = await service.getTreatmentIntentById(
                req.params.treatmentIntentId
            );

            return res.status(200).json({
                success: true,
                message: "Treatment intent fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateTreatmentIntent(req: AuthRequest, res: Response) {

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

            const record = await service.updateTreatmentIntent(
                req.params.treatmentIntentId,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TREATMENT_INTENT_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Treatment intent updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteTreatmentIntent(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deleteTreatmentIntent(
                req.params.treatmentIntentId,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TREATMENT_INTENT_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Treatment intent deleted successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreTreatmentIntent(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restoreTreatmentIntent(
                req.params.treatmentIntentId,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "TREATMENT_INTENT_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Treatment intent restored successfully",
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
