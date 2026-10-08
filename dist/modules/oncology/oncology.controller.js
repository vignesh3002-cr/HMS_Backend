"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OncologyController = void 0;
const express_validator_1 = require("express-validator");
const oncology_service_1 = require("./oncology.service");
const service = new oncology_service_1.OncologyService();
function actingUserId(req) {
    return req.user?.user_id || "SYSTEM";
}
// Tables this module writes to - used to strip the constraint name down to
// just the offending column so the client gets an actionable field name
// instead of the raw "<table>_<column>_check" identifier.
const ONCOLOGY_TABLES = ["ihc_results", "molecular_results", "oncology_staging_detail", "oncology_staging_additional_cancers", "derived_fields"];
function fieldFromConstraintName(constraintName) {
    for (const table of ONCOLOGY_TABLES) {
        if (constraintName.startsWith(`${table}_`) && constraintName.endsWith("_check")) {
            return constraintName.slice(table.length + 1, -"_check".length);
        }
    }
    return constraintName;
}
// Prisma's own error .message for a raw DB constraint violation embeds a
// source-code preview and absolute file path - fine for server logs, never
// safe to hand back to an API caller. Every Prisma error carries a
// clientVersion string, which is what we key off here rather than an
// `instanceof` check (avoids importing every Prisma error subclass).
function handleError(res, error) {
    if (error instanceof oncology_service_1.OncologyValidationError) {
        return res.status(422).json({
            success: false,
            message: "Oncology validation failed",
            errors: error.violations
        });
    }
    if (typeof error?.clientVersion === "string") {
        console.error("[oncology] database error:", error.message);
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
class OncologyController {
    // ---------------- Reference lookups ----------------
    async getCancerTypes(req, res) {
        try {
            const data = await service.listCancerTypes();
            return res.json({ success: true, message: "Cancer types fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getCancerSubtypes(req, res) {
        try {
            const data = await service.listCancerSubtypes(req.params.cancerTypeId);
            return res.json({ success: true, message: "Cancer subtypes fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getStagingReference(req, res) {
        try {
            const data = await service.listStagingReference(req.query.cancer_type_id);
            return res.json({ success: true, message: "Staging reference fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getBiomarkerTests(req, res) {
        try {
            const data = await service.listBiomarkerTests();
            return res.json({ success: true, message: "Biomarker tests fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getMolecularSubtypes(req, res) {
        try {
            const data = await service.listMolecularSubtypes();
            return res.json({ success: true, message: "Molecular subtypes fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getAnatomicalSites(req, res) {
        try {
            const data = await service.listAnatomicalSites(req.params.cancerTypeId);
            return res.json({ success: true, message: "Anatomical sites fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getCancerGrades(req, res) {
        try {
            const data = await service.listCancerGrades(req.params.cancerTypeId);
            return res.json({ success: true, message: "Cancer grades fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getCancerScores(req, res) {
        try {
            const data = await service.listCancerScores(req.params.cancerTypeId);
            return res.json({ success: true, message: "Cancer scores fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getInvestigationParameters(req, res) {
        try {
            const data = await service.listInvestigationParameters(req.params.cancerTypeId);
            return res.json({ success: true, message: "Investigation tests fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getTnmStages(req, res) {
        try {
            const data = await service.listTnmStages(req.params.cancerTypeId);
            return res.json({ success: true, message: "T / N / M stages fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getDiseaseStatuses(req, res) {
        try {
            const data = await service.listDiseaseStatuses();
            return res.json({ success: true, message: "Disease statuses fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Values added from a Diagnosis dropdown ----------------
    // 201 with the new row, or 200 with the row that already had this value.
    async respondReferenceValue(req, res, label, add) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const { row, created } = await add();
            return res.status(created ? 201 : 200).json({
                success: true,
                message: created ? `${label} added successfully` : `${label} already exists`,
                data: row,
                created
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async addAnatomicalSite(req, res) {
        return this.respondReferenceValue(req, res, "Body site", () => service.addAnatomicalSite(req.params.cancerTypeId, req.body.value, actingUserId(req)));
    }
    async addCancerSubtype(req, res) {
        return this.respondReferenceValue(req, res, "Histopathology", () => service.addCancerSubtype(req.params.cancerTypeId, req.body.value, actingUserId(req)));
    }
    async addStagingStage(req, res) {
        return this.respondReferenceValue(req, res, "Cancer stage", () => service.addStagingStage(req.params.cancerTypeId, req.body.value, actingUserId(req)));
    }
    async addCancerGrade(req, res) {
        return this.respondReferenceValue(req, res, "Grade", () => service.addCancerGrade(req.params.cancerTypeId, req.body.value, req.body.system, actingUserId(req)));
    }
    async addCancerScore(req, res) {
        return this.respondReferenceValue(req, res, "Score", () => service.addCancerScore(req.params.cancerTypeId, req.body.value, req.body.system, actingUserId(req)));
    }
    async addTnmStage(req, res) {
        return this.respondReferenceValue(req, res, `${req.body.axis ?? ""} stage`.trim(), () => service.addTnmStage(req.params.cancerTypeId, req.body.axis, req.body.value, actingUserId(req)));
    }
    async addDiseaseStatus(req, res) {
        return this.respondReferenceValue(req, res, "Disease status", () => service.addDiseaseStatus(req.body.value, actingUserId(req)));
    }
    async listInvestigationResults(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const data = await service.listInvestigationResults(req.query.patient_id);
            return res.json({ success: true, message: "Investigation results fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async saveInvestigationResults(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const data = await service.saveInvestigationResults(req.body, actingUserId(req));
            return res.json({ success: true, message: "Investigation results saved successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async reseedReference(req, res) {
        try {
            const result = await service.reseedReferenceData();
            return res.json({ success: true, message: result.message });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    // ---------------- Staging detail workflow ----------------
    async createStagingDetail(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const result = await service.createStagingDetail(req.body, actingUserId(req));
            return res.status(201).json({
                success: true,
                message: "Staging detail created successfully",
                warnings: result.warnings,
                data: result.data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async updateStagingDetail(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const result = await service.updateStagingDetail(req.params.stagingDetailId, req.body, actingUserId(req));
            return res.json({
                success: true,
                message: "Staging detail updated successfully",
                warnings: result.warnings,
                data: result.data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getStagingDetail(req, res) {
        try {
            const data = await service.getStagingDetail(req.params.stagingDetailId);
            return res.json({ success: true, message: "Staging detail fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listStagingDetails(req, res) {
        try {
            const result = await service.listStagingDetails({
                patient_id: req.query.patient_id,
                diagnosis_id: req.query.diagnosis_id,
                encounter_no: req.query.encounter_no,
                employee_id: req.query.employee_id,
                branch_id: req.query.branchId,
                cancer_type_id: req.query.cancer_type_id,
                date_from: req.query.date_from,
                date_to: req.query.date_to,
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                view: req.query.view === "ids" ? "ids" : undefined
            });
            return res.json({
                success: true,
                message: "Staging details fetched successfully",
                data: result.rows,
                pagination: { total: result.total, page: result.page, limit: result.limit }
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async upsertIhc(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const result = await service.upsertIhc(req.params.stagingDetailId, req.body, actingUserId(req));
            return res.json({
                success: true,
                message: "IHC results saved successfully",
                warnings: result.warnings,
                data: result.data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async upsertMolecular(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const result = await service.upsertMolecular(req.params.stagingDetailId, req.body, actingUserId(req));
            return res.json({
                success: true,
                message: "Molecular results saved successfully",
                warnings: result.warnings,
                data: result.data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getDerivedFields(req, res) {
        try {
            const data = await service.getDerivedFields(req.params.stagingDetailId);
            return res.json({ success: true, message: "Derived fields fetched successfully", data });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
}
exports.OncologyController = OncologyController;
