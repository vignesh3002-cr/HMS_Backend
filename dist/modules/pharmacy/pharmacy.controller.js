"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmacyController = void 0;
const express_validator_1 = require("express-validator");
const pharmacy_constants_1 = require("./pharmacy.constants");
const pharmacy_service_1 = require("./pharmacy.service");
const service = new pharmacy_service_1.PharmacyService();
function actingUserId(req) {
    return req.user?.user_id || "SYSTEM";
}
function checkValidation(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            message: errors.array()[0].msg,
            errors: errors.array()
        });
        return false;
    }
    return true;
}
/*
 * The slip's named CHECK / UNIQUE constraints are the last line of defence
 * against a bad lifecycle or a duplicate slip, so a raw database error is
 * translated into the message the pharmacy user needs (same approach as
 * chemotherapy.controller.ts).
 */
function handleError(res, error) {
    if (typeof error?.clientVersion === "string") {
        console.error("[pharmacy] database error:", error.message);
        const detail = `${error.message ?? ""} ${JSON.stringify(error.meta ?? {})}`;
        const known = Object.keys(pharmacy_constants_1.CONSTRAINT_MESSAGES).find((name) => detail.includes(name));
        if (known) {
            return res.status(400).json({ success: false, message: pharmacy_constants_1.CONSTRAINT_MESSAGES[known] });
        }
        return res.status(400).json({
            success: false,
            message: "A database error occurred while saving this pharmacy slip."
        });
    }
    return res.status(400).json({
        success: false,
        message: error.message
    });
}
class PharmacyController {
    async previewSlip(req, res) {
        if (!checkValidation(req, res))
            return;
        try {
            const data = await service.previewFromPlan(req.params.planId);
            return res.json({
                success: true,
                message: "Pharmacy slip preview loaded",
                data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async createSlip(req, res) {
        if (!checkValidation(req, res))
            return;
        try {
            const data = await service.createFromPlan(req.body, actingUserId(req));
            return res.status(201).json({
                success: true,
                message: "Pharmacy slip created",
                data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async listSlips(req, res) {
        if (!checkValidation(req, res))
            return;
        try {
            const data = await service.listSlips({
                status: req.query.status,
                plan_id: req.query.plan_id,
                patient_id: req.query.patient_id,
                branch_id: req.query.branch_id,
                appointment_id: req.query.appointment_id,
                cycle_number: req.query.cycle_number ? Number(req.query.cycle_number) : undefined,
                date_from: req.query.date_from,
                date_to: req.query.date_to,
                search: req.query.search,
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined
            });
            return res.json({
                success: true,
                message: "Pharmacy slips retrieved",
                ...data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async getSlip(req, res) {
        if (!checkValidation(req, res))
            return;
        try {
            const data = await service.getSlip(req.params.pharmacySlipId);
            return res.json({
                success: true,
                message: "Pharmacy slip retrieved",
                data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async updateItems(req, res) {
        if (!checkValidation(req, res))
            return;
        try {
            const data = await service.updateItems(req.params.pharmacySlipId, req.body, actingUserId(req));
            return res.json({
                success: true,
                message: "Pharmacy slip updated",
                data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async cancelSlip(req, res) {
        if (!checkValidation(req, res))
            return;
        try {
            const data = await service.cancel(req.params.pharmacySlipId, req.body, actingUserId(req));
            return res.json({
                success: true,
                message: "Pharmacy slip cancelled",
                data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
    async printSlip(req, res) {
        if (!checkValidation(req, res))
            return;
        try {
            const data = await service.markPrinted(req.params.pharmacySlipId, req.body, actingUserId(req));
            return res.json({
                success: true,
                message: "Printed",
                data
            });
        }
        catch (error) {
            return handleError(res, error);
        }
    }
}
exports.PharmacyController = PharmacyController;
