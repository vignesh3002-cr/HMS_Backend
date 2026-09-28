import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { ConsultationService } from "./consultation.service";

const service = new ConsultationService();

function actingUserId(req: Request): string {
    return (req as any).user?.user_id || "SYSTEM";
}

function firstError(req: Request): string | null {
    const errors = validationResult(req);
    if (errors.isEmpty()) return null;
    return errors.array()[0].msg;
}

function handleError(res: Response, error: any) {
    const message = error?.message ?? "Unexpected error";
    const status = message.toLowerCase().includes("not found") ? 404 : 400;
    return res.status(status).json({ success: false, message });
}

export class ConsultationController {

    // ---------------- Master data ----------------

    async getImmunizations(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.listImmunizations({
                search: req.query.search as string | undefined,
                isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true"
            });
            return res.json({ success: true, message: "Immunizations fetched successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    async createCustomImmunization(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.createCustomImmunization(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Immunization added successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    async getDrugConsumptions(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.listDrugConsumptions({
                search: req.query.search as string | undefined,
                isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true"
            });
            return res.json({ success: true, message: "Drug consumption options fetched successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    async createCustomDrugConsumption(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.createCustomDrugConsumption(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Drug consumption option added successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    async getDietTypes(req: Request, res: Response) {
        try {
            return res.json({ success: true, message: "Diet types fetched successfully", data: service.listDietTypes() });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    // ---------------- Personal history ----------------

    async getPersonalHistory(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.getPersonalHistory(req.params.encounterNo as string);
            return res.json({ success: true, message: "Personal history fetched successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    async upsertPersonalHistory(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.upsertPersonalHistory(
                req.params.encounterNo as string,
                req.body,
                actingUserId(req)
            );
            return res.json({ success: true, message: "Personal history saved successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    // ---------------- Encounter reports ----------------

    async getReports(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.listReports(req.params.encounterNo as string);
            return res.json({ success: true, message: "Reports fetched successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    async addReport(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.addReport(req.params.encounterNo as string, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Report added successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    async updateReport(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.updateReport(req.params.encounterReportId as string, req.body, actingUserId(req));
            return res.json({ success: true, message: "Report updated successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

    async removeReport(req: Request, res: Response) {
        try {
            const error = firstError(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const data = await service.removeReport(req.params.encounterReportId as string);
            return res.json({ success: true, message: "Report removed successfully", data });
        } catch (err: any) {
            return handleError(res, err);
        }
    }

}
