import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { IpdService } from "./ipd.service";
import { DaycareService } from "./ipd.daycare.service";

const service = new IpdService();
const daycareService = new DaycareService(service);

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

            const actor = (req as any).user;

            const admission = await service.createAdmission(req.body, actor.user_id, actor);

            return res.status(201).json({
                success: true,
                message: "Admission created successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
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

            const admission = await service.getAdmissionForActor(
                (req.params.ipNumber || req.params.id) as string,
                (req as any).user
            );

            return res.json({
                success: true,
                message: "Admission fetched successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 404).json({
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

            const admission = await service.updateAdmission(
                req.params.id as string,
                req.body,
                (req as any).user
            );

            return res.json({
                success: true,
                message: "Admission updated successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
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

            const admission = await service.dischargeAdmission(
                req.params.id as string,
                (req as any).user,
                req.body
            );

            return res.json({
                success: true,
                message: "Admission discharged successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
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

            const result = await service.transferAdmission(
                req.params.id as string,
                req.body.targetWardId as string,
                req.body.targetBedId as string,
                req.body.reason as string,
                (req as any).user
            );

            return res.json({
                success: true,
                message: "Admission transferred successfully",
                data: result
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async admitAdmission(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const admission = await service.admitPlanned(
                req.params.id as string,
                (req as any).user,
                req.body
            );

            return res.json({
                success: true,
                message: "Patient admitted successfully",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async cancelAdmission(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const admission = await service.cancelPlanned(
                req.params.id as string,
                (req as any).user,
                req.body?.reason
            );

            return res.json({
                success: true,
                message: "Admission request cancelled",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async markNoShow(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const admission = await service.markNoShow(
                req.params.id as string,
                (req as any).user,
                req.body?.reason
            );

            return res.json({
                success: true,
                message: "Admission request marked as no-show",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async reserveBed(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const admission = await service.reserveBed(
                req.params.id as string,
                (req as any).user,
                req.body
            );

            return res.json({
                success: true,
                message: "Bed reserved",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async releaseReservation(req: Request, res: Response) {

        try {

            const admission = await service.releaseReservation(
                req.params.id as string,
                (req as any).user
            );

            return res.json({
                success: true,
                message: "Bed reservation released",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async bookDaycare(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const admission = await daycareService.book(req.body, (req as any).user);

            return res.status(201).json({
                success: true,
                message: "Daycare booked",
                data: admission
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getDaycareOccupancy(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const occupancy = await service.getDaycareOccupancy(
                req.query.wardId as string,
                req.query.date as string,
                (req as any).user
            );

            return res.json({
                success: true,
                data: occupancy
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
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

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateWard(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const ward = await service.updateWard(req.params.wardId as string, req.body, (req as any).user);

            return res.json({
                success: true,
                message: "Ward updated successfully",
                data: ward
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
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

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateBed(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const bed = await service.updateBed(req.params.bedId as string, req.body, (req as any).user);

            return res.json({
                success: true,
                message: "Bed updated successfully",
                data: bed
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async updateBedStatus(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {

                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });

            }

            const bed = await service.updateBedStatus(
                req.params.id as string,
                req.body.status as string,
                (req as any).user,
                req.body.remarks as string | undefined
            );

            return res.json({
                success: true,
                message: "Bed status updated successfully",
                data: bed
            });

        } catch (error: any) {

            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deleteWard(req: Request, res: Response) {
        try {
            const ward = await service.deleteWard(req.params.wardId as string, (req as any).user);
            return res.json({
                success: true,
                message: "Ward deactivated successfully",
                data: ward
            });
        } catch (error: any) {
            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });
        }
    }

    async deleteBed(req: Request, res: Response) {
        try {
            const bed = await service.deleteBed(req.params.bedId as string, (req as any).user);
            return res.json({
                success: true,
                message: "Bed deactivated successfully",
                data: bed
            });
        } catch (error: any) {
            return res.status(error.status || 400).json({
                success: false,
                message: error.message
            });
        }
    }

}

