import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { IpdService } from "./ipd.service";

const service = new IpdService();

export class IpdController {

    async createAdmission(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const createdBy = (req as any).user?.role || "SYSTEM";

            const admission = await service.createAdmission(req.body, createdBy);

            return res.status(201).json({
                success: true,
                message: "Admission created successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async listAdmissions(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const admissions = await service.listAdmissions({
                branchId: req.query.branchId as string,
                status: req.query.status as string,
                wardId: req.query.wardId as string,
                patientId: req.query.patientId as string,
                date: req.query.date as string,
                search: req.query.search as string,
                page: req.query.page as string,
                limit: req.query.limit as string,
                sortField: req.query.sortField as string,
                sortDirection: req.query.sortDirection as string
            });

            return res.json({
                success: true,
                message: "Admissions fetched successfully",
                data: admissions
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async getAdmissionByIpNumber(req: Request, res: Response) {

        try {

            const admission = await service.getAdmissionByIpNumber(
                (req.params.ipNumber || req.params.id) as string
            );

            return res.json({
                success: true,
                message: "Admission fetched successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateAdmission(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const updatedBy = (req as any).user?.role || "SYSTEM";

            const admission = await service.updateAdmission(
                req.params.id as string,
                req.body,
                updatedBy
            );

            return res.json({
                success: true,
                message: "Admission updated successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async dischargeAdmission(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const closedBy = (req as any).user?.role || "SYSTEM";

            const admission = await service.dischargeAdmission(
                req.params.id as string,
                closedBy,
                req.body
            );

            return res.json({
                success: true,
                message: "Admission discharged successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async transferAdmission(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const transferredBy = (req as any).user?.role || "SYSTEM";

            const result = await service.transferAdmission(
                req.params.id as string,
                req.body.targetWardId as string,
                req.body.targetBedId as string,
                req.body.reason as string,
                transferredBy
            );

            return res.json({
                success: true,
                message: "Admission transferred successfully",
                data: result
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getAdmittedPatientsToday(req: Request, res: Response) {

        try {

            const totalPatients = await service.getAdmittedPatientsToday(
                req.query.branchId as string
            );

            return res.json({
                success: true,
                message: "Admitted patients today fetched successfully",
                data: { totalPatients }
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async getIpdOverview(req: Request, res: Response) {

        try {

            const overview = await service.getIpdOverview(
                req.query.branchId as string
            );

            return res.json({
                success: true,
                message: "IPD overview fetched successfully",
                data: overview
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async listWards(req: Request, res: Response) {

        try {

            const wards = await service.listWards(
                req.query.branchId as string
            );

            return res.json({
                success: true,
                message: "Wards fetched successfully",
                data: wards
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async listBeds(req: Request, res: Response) {

        try {

            const beds = await service.listBeds(
                req.query.wardId as string,
                req.query.branchId as string
            );

            return res.json({
                success: true,
                message: "Beds fetched successfully",
                data: beds
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async createWard(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const ward = await service.createWard(req.body, (req as any).user);

            return res.status(201).json({
                success: true,
                message: "Ward created successfully",
                data: ward
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async createBed(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const bed = await service.createBed(req.body, (req as any).user);

            return res.status(201).json({
                success: true,
                message: "Bed created successfully",
                data: bed
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

}

