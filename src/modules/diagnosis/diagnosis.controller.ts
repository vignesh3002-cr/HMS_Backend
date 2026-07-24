import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest } from "../auth/auth.middleware";
import { DiagnosisService } from "./diagnosis.service";
import { recordAuditLog } from "../../utils/auditLog";

const service = new DiagnosisService();

export class DiagnosisController {

    async createDiagnosis(req: AuthRequest, res: Response) {

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

            const record = await service.createDiagnosis(req.body, createdBy);

            await recordAuditLog({
                username: req.user?.username,
                branchId: req.body.branch_id,
                moduleName: "DIAGNOSIS",
                actionType: "CREATE"
            });

            return res.status(201).json({
                success: true,
                message: "Diagnosis created successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getDiagnoses(req: AuthRequest, res: Response) {

        try {

            const result = await service.getDiagnoses({

                patientId: req.query.patientId as string,

                branchId: req.query.branchId as string,

                departmentId: req.query.departmentId as string,

                doctorId: req.query.doctorId as string,

                cancerTypeId: req.query.cancerTypeId as string,

                diagnosisStatus: req.query.diagnosisStatus as string,

                isActive: req.query.isActive as string,

                search: req.query.search as string,

                page: Number(req.query.page || 1),

                limit: Number(req.query.limit || 10),

                sortBy: (req.query.sortBy as string) || "created_at",

                sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc"

            });

            return res.status(200).json({
                success: true,
                message: "Diagnoses fetched successfully",
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

    async getDiagnosisById(req: AuthRequest, res: Response) {

        try {

            const record = await service.getDiagnosisById(req.params.diagnosisId);

            return res.status(200).json({
                success: true,
                message: "Diagnosis fetched successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateDiagnosis(req: AuthRequest, res: Response) {

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

            const record = await service.updateDiagnosis(
                req.params.diagnosisId,
                req.body,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "DIAGNOSIS",
                actionType: "UPDATE"
            });

            return res.status(200).json({
                success: true,
                message: "Diagnosis updated successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteDiagnosis(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.deleteDiagnosis(
                req.params.diagnosisId,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "DIAGNOSIS",
                actionType: "DELETE"
            });

            return res.status(200).json({
                success: true,
                message: "Diagnosis deleted successfully",
                data: record
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async restoreDiagnosis(req: AuthRequest, res: Response) {

        try {

            const updatedBy = req.user?.username || "SYSTEM";

            const record = await service.restoreDiagnosis(
                req.params.diagnosisId,
                updatedBy
            );

            await recordAuditLog({
                username: req.user?.username,
                moduleName: "DIAGNOSIS",
                actionType: "RESTORE"
            });

            return res.status(200).json({
                success: true,
                message: "Diagnosis restored successfully",
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
