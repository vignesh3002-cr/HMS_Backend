import { Request, Response } from "express";
import { DutyRosterService } from "./dutyRoster.service";

export class DutyRosterController {
    constructor(private readonly service = new DutyRosterService()) {}

    async getAvailableStaff(req: Request, res: Response) {
        try {
            const { branchId, dutyDate, shiftCode, roleInDuty, includeAllBranch } = req.query;
            const staff = await this.service.getAvailableStaff({
                branchId: String(branchId || ""),
                dutyDate: String(dutyDate || ""),
                shiftCode: String(shiftCode || ""),
                roleInDuty: String(roleInDuty || "") as any,
                includeAllBranch: includeAllBranch === "true" || includeAllBranch === "1",
            });
            res.json({ success: true, data: staff });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getBranchShifts(req: Request, res: Response) {
        try {
            const { branchId } = req.query;
            const shifts = await this.service.getBranchShifts(String(branchId || ""));
            res.json({ success: true, data: shifts });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async createBranchShift(req: Request, res: Response) {
        try {
            const shift = await this.service.createBranchShift(req.body);
            res.status(201).json({ success: true, data: shift });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async updateBranchShift(req: Request, res: Response) {
        try {
            const shiftId = String(req.params.shiftId);
            const shift = await this.service.updateBranchShift(shiftId, req.body);
            res.json({ success: true, data: shift });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getTemplates(req: Request, res: Response) {
        try {
            const { branchId } = req.query;
            const templates = await this.service.getTemplates(String(branchId || ""));
            res.json({ success: true, data: templates });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async upsertTemplate(req: Request, res: Response) {
        try {
            const actorUserId = (req as any).user?.user_id;
            const template = await this.service.upsertTemplate(req.body, actorUserId);
            res.json({ success: true, data: template });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async deleteTemplate(req: Request, res: Response) {
        try {
            const templateId = String(req.params.templateId);
            await this.service.deleteTemplate(templateId);
            res.json({ success: true, message: "Template deleted successfully" });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getRoster(req: Request, res: Response) {
        try {
            const { branchId, fromDate, toDate } = req.query;
            const roster = await this.service.getRosterRange(
                String(branchId || ""),
                String(fromDate || ""),
                String(toDate || "")
            );
            res.json({ success: true, data: roster });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async upsertRosterEntry(req: Request, res: Response) {
        try {
            const actorUserId = (req as any).user?.user_id;
            const entry = await this.service.upsertRosterEntry(req.body, actorUserId);
            res.json({ success: true, data: entry });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async deleteRosterEntry(req: Request, res: Response) {
        try {
            const rosterId = String(req.params.rosterId);
            await this.service.deleteRosterEntry(rosterId);
            res.json({ success: true, message: "Roster entry deleted successfully" });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
