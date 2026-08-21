"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChemotherapyController = void 0;
const express_validator_1 = require("express-validator");
const chemotherapy_service_1 = require("./chemotherapy.service");
const service = new chemotherapy_service_1.ChemotherapyService();
function actingUserId(req) {
    return req.user?.user_id || "SYSTEM";
}
const CHEMO_TABLES = [
    "chemotherapy_plan", "chemotherapy_plan_items", "chemotherapy_cycle",
    "chemotherapy_administration", "chemotherapy_adverse_event",
    "chemotherapy_vitals", "chemotherapy_lab_review", "chemotherapy_followup"
];
function fieldFromConstraintName(constraintName) {
    for (const table of CHEMO_TABLES) {
        if (constraintName.startsWith(`${table}_`) && constraintName.endsWith("_check")) {
            return constraintName.slice(table.length + 1, -"_check".length);
        }
    }
    return constraintName;
}
function handleError(res, error) {
    if (typeof error?.clientVersion === "string") {
        console.error("[chemotherapy] database error:", error.message);
        const constraintMatch = /constraint "([a-zA-Z0-9_]+)"/.exec(error.message ?? "");
        return res.status(400).json({
            success: false,
            message: constraintMatch
                ? `Invalid value for '${fieldFromConstraintName(constraintMatch[1])}' - it does not match the allowed set of values for this field.`
                : "A database error occurred while saving this record."
        });
    }
    return res.status(400).json({
        success: false,
        message: error.message
    });
}
function checkValidation(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
        return false;
    }
    return true;
}
class ChemotherapyController {
    // ---------------- Regimen protocols ----------------
    async listRegimenProtocols(req, res) {
        try {
            const data = await service.listRegimenProtocols({
                cancer_type_id: req.query.cancer_type_id,
                subtype_id: req.query.subtype_id
            });
            return res.json({ success: true, message: "Regimen protocols fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getRegimenProtocol(req, res) {
        try {
            const data = await service.getRegimenProtocol(req.params.protocolId);
            return res.json({ success: true, message: "Regimen protocol fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async createRegimenProtocol(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.createRegimenProtocol(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Regimen protocol created successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async updateRegimenProtocol(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.updateRegimenProtocol(req.params.protocolId, req.body, actingUserId(req));
            return res.json({ success: true, message: "Regimen protocol updated successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async addRegimenProtocolItem(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.addRegimenProtocolItem(req.params.protocolId, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Protocol item added successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async removeRegimenProtocolItem(req, res) {
        try {
            const data = await service.removeRegimenProtocolItem(req.params.protocolId, req.params.protocolItemId, actingUserId(req));
            return res.json({ success: true, message: "Protocol item removed successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Plan ----------------
    async previewPlan(req, res) {
        try {
            const data = await service.previewPlan(req.query.staging_detail_id);
            return res.json({ success: true, message: "Plan preview fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async createPlan(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.createPlan(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Chemotherapy plan created successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getPlan(req, res) {
        try {
            const data = await service.getPlan(req.params.planId);
            return res.json({ success: true, message: "Chemotherapy plan fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listPlans(req, res) {
        try {
            const result = await service.listPlans({
                patient_id: req.query.patient_id,
                diagnosis_id: req.query.diagnosis_id,
                employee_id: req.query.employee_id,
                branch_id: req.query.branchId,
                department_id: req.query.department_id,
                status: req.query.status,
                date_from: req.query.date_from,
                date_to: req.query.date_to,
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined
            });
            return res.json({
                success: true,
                message: "Chemotherapy plans fetched successfully",
                data: result.rows,
                pagination: { total: result.total, page: result.page, limit: result.limit }
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async updatePlan(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.updatePlan(req.params.planId, req.body, actingUserId(req));
            return res.json({ success: true, message: "Chemotherapy plan updated successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async changePlanStatus(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.changePlanStatus(req.params.planId, req.body, actingUserId(req));
            return res.json({ success: true, message: `Plan status updated to ${data.treatment_status}`, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Plan items ----------------
    async addPlanItem(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.addPlanItem(req.params.planId, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Drug added to plan successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async updatePlanItem(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.updatePlanItem(req.params.planId, req.params.planItemId, req.body, actingUserId(req));
            return res.json({ success: true, message: "Plan item updated successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async removePlanItem(req, res) {
        try {
            const data = await service.removePlanItem(req.params.planId, req.params.planItemId, actingUserId(req));
            return res.json({ success: true, message: "Plan item removed successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Cycles ----------------
    async createCycle(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.createCycle(req.params.planId, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Cycle created successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listCyclesForPlan(req, res) {
        try {
            const data = await service.listCyclesForPlan(req.params.planId);
            return res.json({ success: true, message: "Cycles fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getCycle(req, res) {
        try {
            const data = await service.getCycle(req.params.cycleId);
            return res.json({ success: true, message: "Cycle fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async updateCycle(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.updateCycle(req.params.cycleId, req.body, actingUserId(req));
            return res.json({ success: true, message: "Cycle updated successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async changeCycleStatus(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.changeCycleStatus(req.params.cycleId, req.body, actingUserId(req));
            return res.json({ success: true, message: `Cycle status updated to ${data.cycle_status}`, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Administration ----------------
    async recordAdministration(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.recordAdministration(req.params.cycleId, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Administration recorded successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listAdministrations(req, res) {
        try {
            const data = await service.listAdministrations(req.params.cycleId);
            return res.json({ success: true, message: "Administrations fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Vitals ----------------
    async recordVitals(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.recordVitals(req.params.cycleId, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Vitals recorded successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listVitals(req, res) {
        try {
            const data = await service.listVitals(req.params.cycleId);
            return res.json({ success: true, message: "Vitals fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Adverse events ----------------
    async recordAdverseEvent(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.recordAdverseEvent(req.params.cycleId, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Adverse event recorded successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listAdverseEvents(req, res) {
        try {
            const data = await service.listAdverseEvents(req.params.cycleId);
            return res.json({ success: true, message: "Adverse events fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Lab review ----------------
    async recordLabReview(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.recordLabReview(req.params.cycleId, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Lab review recorded successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listLabReviews(req, res) {
        try {
            const data = await service.listLabReviews(req.params.cycleId);
            return res.json({ success: true, message: "Lab reviews fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Followup ----------------
    async recordFollowup(req, res) {
        try {
            if (!checkValidation(req, res))
                return;
            const data = await service.recordFollowup(req.params.cycleId, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Follow-up recorded successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listFollowups(req, res) {
        try {
            const data = await service.listFollowups(req.params.cycleId);
            return res.json({ success: true, message: "Follow-ups fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
}
exports.ChemotherapyController = ChemotherapyController;
