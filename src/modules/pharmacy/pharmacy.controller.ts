import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { CONSTRAINT_MESSAGES } from "./pharmacy.constants";
import { PharmacyService } from "./pharmacy.service";

const service = new PharmacyService();

function actingUserId(req: Request): string {
    return (req as any).user?.user_id || "SYSTEM";
}

function checkValidation(req: Request, res: Response): boolean {

    const errors = validationResult(req);

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
function handleError(res: Response, error: any) {

    if (typeof error?.clientVersion === "string") {

        console.error("[pharmacy] database error:", error.message);

        const detail = `${error.message ?? ""} ${JSON.stringify(error.meta ?? {})}`;
        const known = Object.keys(CONSTRAINT_MESSAGES).find((name) => detail.includes(name));

        if (known) {
            return res.status(400).json({ success: false, message: CONSTRAINT_MESSAGES[known] });
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

export class PharmacyController {

    async previewSlip(req: Request, res: Response) {

        if (!checkValidation(req, res)) return;

        try {

            const data = await service.previewFromPlan(req.params.planId as string);

            return res.json({
                success: true,
                message: "Pharmacy slip preview loaded",
                data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async createSlip(req: Request, res: Response) {

        if (!checkValidation(req, res)) return;

        try {

            const data = await service.createFromPlan(req.body, actingUserId(req));

            return res.status(201).json({
                success: true,
                message: "Pharmacy slip created",
                data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listSlips(req: Request, res: Response) {

        if (!checkValidation(req, res)) return;

        try {

            const data = await service.listSlips({
                status: req.query.status as string,
                plan_id: req.query.plan_id as string,
                patient_id: req.query.patient_id as string,
                branch_id: req.query.branch_id as string,
                appointment_id: req.query.appointment_id as string,
                cycle_number: req.query.cycle_number ? Number(req.query.cycle_number) : undefined,
                date_from: req.query.date_from as string,
                date_to: req.query.date_to as string,
                search: req.query.search as string,
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined
            });

            return res.json({
                success: true,
                message: "Pharmacy slips retrieved",
                ...data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getSlip(req: Request, res: Response) {

        if (!checkValidation(req, res)) return;

        try {

            const data = await service.getSlip(req.params.pharmacySlipId as string);

            return res.json({
                success: true,
                message: "Pharmacy slip retrieved",
                data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updateItems(req: Request, res: Response) {

        if (!checkValidation(req, res)) return;

        try {

            const data = await service.updateItems(
                req.params.pharmacySlipId as string,
                req.body,
                actingUserId(req)
            );

            return res.json({
                success: true,
                message: "Pharmacy slip updated",
                data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async cancelSlip(req: Request, res: Response) {

        if (!checkValidation(req, res)) return;

        try {

            const data = await service.cancel(
                req.params.pharmacySlipId as string,
                req.body,
                actingUserId(req)
            );

            return res.json({
                success: true,
                message: "Pharmacy slip cancelled",
                data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async printSlip(req: Request, res: Response) {

        if (!checkValidation(req, res)) return;

        try {

            const data = await service.markPrinted(
                req.params.pharmacySlipId as string,
                req.body,
                actingUserId(req)
            );

            return res.json({
                success: true,
                message: "Printed",
                data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

}