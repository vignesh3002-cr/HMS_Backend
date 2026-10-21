import { Request, Response } from "express";
import { FollowupService } from "./followup.service";

const service = new FollowupService();

// The signed-in user (never taken from the query string).
const actor = (req: Request) => {
    const user = (req as any).user ?? {};
    return { userId: String(user.user_id ?? ""), role: String(user.role ?? "") };
};

const branchIdOf = (req: Request) => {
    const value = (req.query.branchId as string | undefined) ?? (req.headers["x-branch-id"] as string | undefined);
    return value && value !== "__ALL_BRANCHES__" ? value.trim() : undefined;
};

const fail = (res: Response, error: any) => {
    const message = error?.message ?? "Unexpected error";
    const status = /access/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
    return res.status(status).json({ success: false, message });
};

export class FollowupController {

    async listAlerts(req: Request, res: Response) {
        try {
            const { userId, role } = actor(req);
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
            const data = await service.listAlerts(userId, role, branchIdOf(req));
            return res.json({ success: true, message: "Follow-up alerts fetched successfully", data });
        } catch (error: any) {
            return fail(res, error);
        }
    }

    async markRead(req: Request, res: Response) {
        try {
            const { userId, role } = actor(req);
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
            const encounterNos = Array.isArray(req.body?.encounter_nos)
                ? (req.body.encounter_nos as unknown[]).map(String)
                : null;
            if (!encounterNos && req.body?.all !== true) {
                return res.status(400).json({ success: false, message: "Send encounter_nos or all: true" });
            }
            const data = await service.markRead(userId, role, encounterNos, branchIdOf(req));
            return res.json({ success: true, message: "Follow-up alerts marked as read", data });
        } catch (error: any) {
            return fail(res, error);
        }
    }

    async dismiss(req: Request, res: Response) {
        try {
            const { userId, role } = actor(req);
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
            const data = await service.dismiss(userId, role, String(req.params.encounterNo));
            return res.json({ success: true, message: "Follow-up alert dismissed", data });
        } catch (error: any) {
            return fail(res, error);
        }
    }

}
