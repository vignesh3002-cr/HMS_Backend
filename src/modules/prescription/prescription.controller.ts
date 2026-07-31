import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { PrescriptionService } from "./prescription.service";

const service = new PrescriptionService();

export class PrescriptionController {

    async createPrescription(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const createdBy = req.user?.role || "SYSTEM";
            const prescription = await service.createPrescription(req.body, createdBy);

            return res.status(201).json({
                success: true,
                message: "Prescription created successfully",
                data: prescription
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getPrescriptions(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const prescriptions = await service.getPrescriptions({
                branchId: req.query.branchId as string | undefined,
                doctorId: req.query.doctorId as string | undefined,
                patientHistoryId: req.query.patientHistoryId as string | undefined,
                appointmentId: req.query.appointmentId as string | undefined,
                diagnosisId: req.query.diagnosisId as string | undefined,
                status: req.query.status as string | undefined,
                date: req.query.date as string | undefined,
                dateFrom: req.query.dateFrom as string | undefined,
                dateTo: req.query.dateTo as string | undefined,
                search: req.query.search as string | undefined,
                sortBy: req.query.sortBy as any,
                sortOrder: req.query.sortOrder as any,
                page: Number(req.query.page || 1),
                limit: Number(req.query.limit || 10)
            });

            return res.json({
                success: true,
                message: "Prescriptions fetched successfully",
                data: prescriptions
            });

        } catch (error: any) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }

    async getPrescriptionById(req: Request, res: Response) {

        try {

            const prescription = await service.getPrescriptionById(String(req.params.prescriptionId));

            return res.json({
                success: true,
                message: "Prescription fetched successfully",
                data: prescription
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async updatePrescription(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const actingRole = req.user?.role || "SYSTEM";
            const prescription = await service.updatePrescription(String(req.params.prescriptionId), req.body, actingRole);

            return res.json({
                success: true,
                message: "Prescription updated successfully",
                data: prescription
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deletePrescription(req: Request, res: Response) {

        try {

            const prescription = await service.deletePrescription(String(req.params.prescriptionId));

            return res.json({
                success: true,
                message: "Prescription cancelled successfully",
                data: prescription
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getPrescriptionItems(req: Request, res: Response) {

        try {

            const items = await service.getPrescriptionItems(String(req.params.prescriptionId));

            return res.json({
                success: true,
                message: "Prescription items fetched successfully",
                data: items
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

    async addPrescriptionItem(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const item = await service.addPrescriptionItem(String(req.params.prescriptionId), req.body);

            return res.status(201).json({
                success: true,
                message: "Medicine added to prescription successfully",
                data: item
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async updatePrescriptionItem(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: errors.array()[0].msg,
                    errors: errors.array()
                });
            }

            const item = await service.updatePrescriptionItem(String(req.params.prescriptionId), String(req.params.itemId), req.body);

            return res.json({
                success: true,
                message: "Prescription item updated successfully",
                data: item
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async deletePrescriptionItem(req: Request, res: Response) {

        try {

            await service.deletePrescriptionItem(String(req.params.prescriptionId), String(req.params.itemId));

            return res.json({
                success: true,
                message: "Prescription item removed successfully"
            });

        } catch (error: any) {

            return res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }

    async getSuggestedMedicines(req: Request, res: Response) {

        try {

            const medicines = await service.getSuggestedMedicines(String(req.params.diagnosisId));

            return res.json({
                success: true,
                message: "Suggested medicines fetched successfully",
                data: medicines
            });

        } catch (error: any) {

            return res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }

}
