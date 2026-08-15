import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { DiagnosisService } from "./diagnosis.service";

const service = new DiagnosisService();

export class DiagnosisController {
    async getDiagnosisCategories(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const query = {
                search: req.query.search as string,
                activeOnly: req.query.activeOnly === "true",
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 50),
            };

            const result = await service.getDiagnosisCategories(query);

            return res.json({
                success: true,
                message: "Diagnosis categories fetched successfully",
                data: result,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getDiagnosesByCategory(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const query = {
                categoryId: req.params.categoryId as string,
                search: req.query.search as string,
                activeOnly: req.query.activeOnly === "true",
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 50),
            };

            const result = await service.getDiagnosesByCategory(query);

            return res.json({
                success: true,
                message: "Diagnoses fetched successfully",
                data: result,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async getDiagnosisById(req: Request, res: Response) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array(),
                });
            }

            const diagnosis = await service.getDiagnosisById(req.params.diagnosisId as string);

            return res.json({
                success: true,
                message: "Diagnosis fetched successfully",
                data: diagnosis,
            });
        } catch (error: any) {
            if (error.message === "Diagnosis not found") {
                return res.status(404).json({
                    success: false,
                    message: error.message,
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}