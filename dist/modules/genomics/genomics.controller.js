"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genomicsController = exports.GenomicsController = void 0;
const express_validator_1 = require("express-validator");
const client_1 = require("@prisma/client");
const genomics_service_1 = require("./genomics.service");
function actingUserId(req) {
    return req.user?.user_id || "SYSTEM";
}
function handleError(res, error) {
    if (error instanceof genomics_service_1.GenomicValidationError) {
        return res.status(400).json({
            success: false,
            message: error.message,
            errors: error.errors,
        });
    }
    if (error instanceof genomics_service_1.GenomicNotFoundError) {
        return res.status(404).json({ success: false, message: error.message });
    }
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        // Unique / check constraint violations reach here when the screen
        // missed a rule; the database stays the last line of defence.
        return res.status(400).json({
            success: false,
            message: error.code === "P2002"
                ? "A duplicate value already exists."
                : error.message.split("\n").pop() || "Could not save this genomic report.",
        });
    }
    return res.status(500).json({
        success: false,
        message: error?.message || "Could not process this genomic report.",
    });
}
class GenomicsController {
    service;
    constructor(service = genomics_service_1.genomicsService) {
        this.service = service;
    }
    checkValidation(req, res) {
        const result = (0, express_validator_1.validationResult)(req);
        if (!result.isEmpty()) {
            res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: result.array().map((item) => ({
                    field: item.type === "field" ? item.path : "body",
                    message: item.msg,
                })),
            });
            return false;
        }
        return true;
    }
    getCancerSites = async (_req, res) => {
        try {
            const data = await this.service.getCancerSites();
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    getGenes = async (req, res) => {
        if (!this.checkValidation(req, res))
            return;
        try {
            const data = await this.service.getGenes(String(req.query.site ?? ""), String(req.query.sampleType ?? ""));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    getLabs = async (req, res) => {
        try {
            const data = await this.service.getLabs(String(req.query.patientId ?? ""));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    getKeyAlterations = async (req, res) => {
        try {
            const data = await this.service.getKeyAlterations(String(req.query.patientId ?? ""));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    listTests = async (req, res) => {
        try {
            const data = await this.service.listTests(String(req.params.patientId));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    getTest = async (req, res) => {
        try {
            const data = await this.service.getTest(String(req.params.testId), actingUserId(req));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    createTest = async (req, res) => {
        if (!this.checkValidation(req, res))
            return;
        try {
            const data = await this.service.createTest(String(req.params.patientId), req.body, actingUserId(req));
            return res.status(201).json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    updateTest = async (req, res) => {
        if (!this.checkValidation(req, res))
            return;
        try {
            const data = await this.service.updateTest(String(req.params.testId), req.body, actingUserId(req));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    deleteTest = async (req, res) => {
        try {
            const data = await this.service.deleteTest(String(req.params.testId), String(req.body?.reason ?? ""), actingUserId(req));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    listGeneMaster = async (req, res) => {
        try {
            const data = await this.service.listGeneMaster({
                cancerSite: req.query.site ? String(req.query.site) : undefined,
                scope: req.query.scope ? String(req.query.scope) : undefined,
            });
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    createGene = async (req, res) => {
        if (!this.checkValidation(req, res))
            return;
        try {
            const data = await this.service.createGene({
                cancerSite: String(req.body.cancerSite ?? ""),
                scope: String(req.body.scope ?? ""),
                geneSymbol: String(req.body.geneSymbol ?? ""),
                sortOrder: req.body.sortOrder,
                source: req.body.source,
                specSite: req.body.specSite,
            }, actingUserId(req));
            return res.status(201).json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    updateGene = async (req, res) => {
        try {
            const data = await this.service.updateGene(String(req.params.geneMasterId), {
                geneSymbol: req.body.geneSymbol,
                sortOrder: req.body.sortOrder,
                active: req.body.active,
                cancerSite: req.body.cancerSite,
                scope: req.body.scope,
            }, actingUserId(req));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
    deleteGene = async (req, res) => {
        try {
            const data = await this.service.deleteGene(String(req.params.geneMasterId), actingUserId(req));
            return res.json({ success: true, data });
        }
        catch (error) {
            return handleError(res, error);
        }
    };
}
exports.GenomicsController = GenomicsController;
exports.genomicsController = new GenomicsController();
