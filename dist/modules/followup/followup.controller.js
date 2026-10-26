"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowupController = void 0;
const followup_service_1 = require("./followup.service");
const service = new followup_service_1.FollowupService();
// The signed-in user (never taken from the query string).
const actor = (req) => {
    const user = req.user ?? {};
    return { userId: String(user.user_id ?? ""), role: String(user.role ?? "") };
};
const branchIdOf = (req) => {
    const value = req.query.branchId ?? req.headers["x-branch-id"];
    return value && value !== "__ALL_BRANCHES__" ? value.trim() : undefined;
};
const fail = (res, error) => {
    const message = error?.message ?? "Unexpected error";
    const status = /access/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
    return res.status(status).json({ success: false, message });
};
class FollowupController {
    async listAlerts(req, res) {
        try {
            const { userId, role } = actor(req);
            if (!userId)
                return res.status(401).json({ success: false, message: "Unauthorized" });
            const data = await service.listAlerts(userId, role, branchIdOf(req));
            return res.json({ success: true, message: "Follow-up alerts fetched successfully", data });
        }
        catch (error) {
            return fail(res, error);
        }
    }
    async markRead(req, res) {
        try {
            const { userId, role } = actor(req);
            if (!userId)
                return res.status(401).json({ success: false, message: "Unauthorized" });
            const encounterNos = Array.isArray(req.body?.encounter_nos)
                ? req.body.encounter_nos.map(String)
                : null;
            if (!encounterNos && req.body?.all !== true) {
                return res.status(400).json({ success: false, message: "Send encounter_nos or all: true" });
            }
            const data = await service.markRead(userId, role, encounterNos, branchIdOf(req));
            return res.json({ success: true, message: "Follow-up alerts marked as read", data });
        }
        catch (error) {
            return fail(res, error);
        }
    }
    async dismiss(req, res) {
        try {
            const { userId, role } = actor(req);
            if (!userId)
                return res.status(401).json({ success: false, message: "Unauthorized" });
            const data = await service.dismiss(userId, role, String(req.params.encounterNo));
            return res.json({ success: true, message: "Follow-up alert dismissed", data });
        }
        catch (error) {
            return fail(res, error);
        }
    }
}
exports.FollowupController = FollowupController;
