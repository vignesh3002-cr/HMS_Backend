"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DutyRosterController = void 0;
const dutyRoster_service_1 = require("./dutyRoster.service");
class DutyRosterController {
    service;
    constructor(service = new dutyRoster_service_1.DutyRosterService()) {
        this.service = service;
    }
    async getAvailableStaff(req, res) {
        try {
            const { branchId, dutyDate, shiftCode, roleInDuty, includeAllBranch } = req.query;
            const staff = await this.service.getAvailableStaff({
                branchId: String(branchId || ""),
                dutyDate: String(dutyDate || ""),
                shiftCode: String(shiftCode || ""),
                roleInDuty: String(roleInDuty || ""),
                includeAllBranch: includeAllBranch === "true" || includeAllBranch === "1",
            });
            res.json({ success: true, data: staff });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async getBranchShifts(req, res) {
        try {
            const { branchId } = req.query;
            const shifts = await this.service.getBranchShifts(String(branchId || ""));
            res.json({ success: true, data: shifts });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async createBranchShift(req, res) {
        try {
            const shift = await this.service.createBranchShift(req.body);
            res.status(201).json({ success: true, data: shift });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async updateBranchShift(req, res) {
        try {
            const shiftId = String(req.params.shiftId);
            const shift = await this.service.updateBranchShift(shiftId, req.body);
            res.json({ success: true, data: shift });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async getTemplates(req, res) {
        try {
            const { branchId } = req.query;
            const templates = await this.service.getTemplates(String(branchId || ""));
            res.json({ success: true, data: templates });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async upsertTemplate(req, res) {
        try {
            const actorUserId = req.user?.user_id;
            const template = await this.service.upsertTemplate(req.body, actorUserId);
            res.json({ success: true, data: template });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async deleteTemplate(req, res) {
        try {
            const templateId = String(req.params.templateId);
            await this.service.deleteTemplate(templateId);
            res.json({ success: true, message: "Template deleted successfully" });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async getRoster(req, res) {
        try {
            const { branchId, fromDate, toDate } = req.query;
            const roster = await this.service.getRosterRange(String(branchId || ""), String(fromDate || ""), String(toDate || ""));
            res.json({ success: true, data: roster });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async upsertRosterEntry(req, res) {
        try {
            const actorUserId = req.user?.user_id;
            const entry = await this.service.upsertRosterEntry(req.body, actorUserId);
            res.json({ success: true, data: entry });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    async deleteRosterEntry(req, res) {
        try {
            const rosterId = String(req.params.rosterId);
            await this.service.deleteRosterEntry(rosterId);
            res.json({ success: true, message: "Roster entry deleted successfully" });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.DutyRosterController = DutyRosterController;
