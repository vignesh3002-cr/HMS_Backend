"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultationController = void 0;
const express_validator_1 = require("express-validator");
const consultation_service_1 = require("./consultation.service");
const service = new consultation_service_1.ConsultationService();
function actingUserId(req) {
    return req.user?.user_id || "SYSTEM";
}
function firstError(req) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (errors.isEmpty())
        return null;
    return errors.array()[0].msg;
}
function handleError(res, error) {
    const message = error?.message ?? "Unexpected error";
    const status = message.toLowerCase().includes("not found") ? 404 : 400;
    return res.status(status).json({ success: false, message });
}
class ConsultationController {
    // ---------------- Master data ----------------
    async getImmunizations(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.listImmunizations({
                search: req.query.search,
                isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true"
            });
            return res.json({ success: true, message: "Immunizations fetched successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async createCustomImmunization(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.createCustomImmunization(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Immunization added successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async getDrugConsumptions(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.listDrugConsumptions({
                search: req.query.search,
                isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true"
            });
            return res.json({ success: true, message: "Drug consumption options fetched successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async createCustomDrugConsumption(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.createCustomDrugConsumption(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Drug consumption option added successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async getGeneralExaminationFindings(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.listGeneralExaminationFindings({
                search: req.query.search,
                isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true"
            });
            return res.json({ success: true, message: "General examination findings fetched successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async createCustomGeneralExaminationFinding(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.createCustomGeneralExaminationFinding(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "General examination finding added successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async getTreatmentTypes(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.listTreatmentTypes({
                search: req.query.search,
                isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true"
            });
            return res.json({ success: true, message: "Treatment types fetched successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async createCustomTreatmentType(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.createCustomTreatmentType(req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Treatment type added successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async getDietTypes(req, res) {
        try {
            return res.json({ success: true, message: "Diet types fetched successfully", data: service.listDietTypes() });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    // ---------------- Personal history ----------------
    async getPersonalHistory(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.getPersonalHistory(req.params.encounterNo);
            return res.json({ success: true, message: "Personal history fetched successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async upsertPersonalHistory(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.upsertPersonalHistory(req.params.encounterNo, req.body, actingUserId(req));
            return res.json({ success: true, message: "Personal history saved successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    // ---------------- Encounter reports ----------------
    async getReports(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.listReports(req.params.encounterNo);
            return res.json({ success: true, message: "Reports fetched successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async addReport(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.addReport(req.params.encounterNo, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Report added successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async updateReport(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.updateReport(req.params.encounterReportId, req.body, actingUserId(req));
            return res.json({ success: true, message: "Report updated successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async removeReport(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.removeReport(req.params.encounterReportId);
            return res.json({ success: true, message: "Report removed successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    // ---------------- Encounter molecular tests ----------------
    async getMolecularTestOptions(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.listMolecularTestOptions();
            return res.json({ success: true, message: "Molecular test options fetched successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async getMolecularTests(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.listMolecularTests(req.params.encounterNo);
            return res.json({ success: true, message: "Molecular tests fetched successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async addMolecularTest(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.addMolecularTest(req.params.encounterNo, req.body, actingUserId(req));
            return res.status(201).json({ success: true, message: "Molecular test added successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async updateMolecularTest(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.updateMolecularTest(req.params.encounterMolecularTestId, req.body);
            return res.json({ success: true, message: "Molecular test updated successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
    async removeMolecularTest(req, res) {
        try {
            const error = firstError(req);
            if (error)
                return res.status(400).json({ success: false, message: error });
            const data = await service.removeMolecularTest(req.params.encounterMolecularTestId);
            return res.json({ success: true, message: "Molecular test removed successfully", data });
        }
        catch (err) {
            return handleError(res, err);
        }
    }
}
exports.ConsultationController = ConsultationController;
