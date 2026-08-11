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
const ONCOLOGY_TABLES = ["ihc_results", "molecular_results", "oncology_staging_detail", "derived_fields"];
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
                employee_id: req.query.employee_id,
                branch_id: req.query.branchId,
                cancer_type_id: req.query.cancer_type_id,
                date_from: req.query.date_from,
                date_to: req.query.date_to,
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined
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
