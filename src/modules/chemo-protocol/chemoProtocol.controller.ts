import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { ChemoProtocolService } from "./chemoProtocol.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new ChemoProtocolService();

export class ChemoProtocolController {

    async createProtocol(req: AuthRequest, res: Response) {

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

            const record = await service.createProtocol(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_MASTER",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Chemotherapy protocol created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getProtocols(req: AuthRequest, res: Response) {

        try {

            const result = await service.getProtocols({

                search: req.query.search as string,

                cancerTypeId: req.query.cancerTypeId as string,

                cancerStageId: req.query.cancerStageId as string,

                treatmentIntentId: req.query.treatmentIntentId as string,

                isActive: req.query.isActive as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocols fetched successfully",
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

    async getProtocolById(req: AuthRequest, res: Response) {

        try {

            const record = await service.getProtocolById(req.params.protocolId);

            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocol fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateProtocol(req: AuthRequest, res: Response) {

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

            const record = await service.updateProtocol(
                req.params.protocolId,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_MASTER",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocol updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteProtocol(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deleteProtocol(
                req.params.protocolId,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_MASTER",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocol deleted successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreProtocol(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restoreProtocol(
                req.params.protocolId,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_MASTER",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Chemotherapy protocol restored successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    // ---- Protocol <-> Drug bridge ----

    async addDrugToProtocol(req: AuthRequest, res: Response) {

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

            const record = await service.addDrugToProtocol(
                req.params.protocolId,
                req.body,
                createdBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_DRUG",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Drug added to protocol successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateProtocolDrug(req: AuthRequest, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const record = await service.updateProtocolDrug(
                req.params.protocolDrugId,
                req.body
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_DRUG",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Protocol drug entry updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async removeDrugFromProtocol(req: AuthRequest, res: Response) {

        try {

            const record = await service.removeDrugFromProtocol(
                req.params.protocolDrugId
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "CHEMO_PROTOCOL_DRUG",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Drug removed from protocol successfully",
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
