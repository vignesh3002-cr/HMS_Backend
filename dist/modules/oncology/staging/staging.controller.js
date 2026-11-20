"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StagingController = void 0;
const express_validator_1 = require("express-validator");
const staging_service_1 = require("./staging.service");
const service = new staging_service_1.StagingService();
function actingUserId(req) {
    return req.user?.user_id || "SYSTEM";
}
function handleError(res, error) {
    if (typeof error?.clientVersion === "string") {
        console.error("[staging] database error:", error.message);
        return res.status(400).json({
            success: false,
            message: "A database error occurred while saving this stage record.",
        });
    }
    return res.status(400).json({ success: false, message: error.message });
}
function firstValidationError(req) {
    return (0, express_validator_1.validationResult)(req);
}
/** Server-side conditions: accept numbers or band strings, keyed by criterion. */
function normaliseConditions(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return undefined;
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        if (value === null || value === undefined || value === "")
            continue;
        out[key] = typeof value === "number" ? value : String(value);
    }
    return out;
}
class StagingController {
    async listSchemas(req, res) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const data = await service.listSchemasForCancerType(req.params.cancerTypeId, req.query.patientId || undefined);
            return res.json({
                success: true,
                message: "Staging schemas fetched successfully",
                data,
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getSchema(req, res) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const context = (req.query.context || "CLINICAL");
            const data = await service.getSchemaDetail(req.params.schemaId, context);
            return res.json({
                success: true,
                message: "Staging schema fetched successfully",
                data,
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async derive(req, res) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const data = await service.derive({
                schema_id: req.body.schemaId,
                context: req.body.context,
                t: req.body.t ?? null,
                n: req.body.n ?? null,
                m: req.body.m ?? null,
                s: req.body.s ?? null,
                conditions: normaliseConditions(req.body.conditions),
            });
            return res.json({
                success: true,
                message: "Stage derived successfully",
                data,
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listRecords(req, res) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const data = await service.listRecords(req.query.stagingDetailId);
            return res.json({
                success: true,
                message: "Stage records fetched successfully",
                data,
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async saveRecords(req, res) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const records = req.body.records.map((record) => ({
                cancer_type_id: record.cancerTypeId ?? null,
                schema_id: record.schemaId,
                context: record.context,
                t: record.t ?? null,
                n: record.n ?? null,
                m: record.m ?? null,
                s: record.s ?? null,
                conditions: normaliseConditions(record.conditions),
                modifiers: record.modifiers,
                final_stage: record.finalStage ?? null,
                is_overridden: record.isOverridden ?? false,
                override_reason: record.overrideReason ?? null,
                stage_date: record.stageDate ?? null,
                notes: record.notes ?? null,
            }));
            const data = await service.saveRecords({
                staging_detail_id: req.body.stagingDetailId,
                replace: req.body.replace,
                records,
            }, actingUserId(req));
            return res.json({
                success: true,
                message: "Stage records saved successfully",
                data,
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async deleteRecord(req, res) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const data = await service.deactivateRecord(req.params.stageRecordId, actingUserId(req));
            return res.json({
                success: true,
                message: "Stage record removed successfully",
                data,
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async history(req, res) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }
            const data = await service.history(req.query.patientId, req.query.cancerTypeId || undefined);
            return res.json({
                success: true,
                message: "Stage history fetched successfully",
                data,
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
}
exports.StagingController = StagingController;
