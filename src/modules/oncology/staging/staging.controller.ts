import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { StagingService } from "./staging.service";
import type { StageContext } from "./types";

const service = new StagingService();

function actingUserId(req: Request): string {
    return (req as any).user?.user_id || "SYSTEM";
}

function handleError(res: Response, error: any) {
    if (typeof error?.clientVersion === "string") {
        console.error("[staging] database error:", error.message);
        return res.status(400).json({
            success: false,
            message: "A database error occurred while saving this stage record.",
        });
    }

    return res.status(400).json({ success: false, message: error.message });
}

function firstValidationError(req: Request) {
    return validationResult(req);
}

/** Server-side conditions: accept numbers or band strings, keyed by criterion. */
function normaliseConditions(raw: any) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const out: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (value === null || value === undefined || value === "") continue;
        out[key] = typeof value === "number" ? value : String(value);
    }
    return out;
}

export class StagingController {

    async listSchemas(req: Request, res: Response) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const data = await service.listSchemasForCancerType(
                req.params.cancerTypeId as string,
                (req.query.patientId as string) || undefined
            );

            return res.json({
                success: true,
                message: "Staging schemas fetched successfully",
                data,
            });
        } catch (error: any) {
            return handleError(res, error);
        }
    }

    async getSchema(req: Request, res: Response) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const context = ((req.query.context as string) || "CLINICAL") as StageContext;
            const data = await service.getSchemaDetail(req.params.schemaId as string, context);

            return res.json({
                success: true,
                message: "Staging schema fetched successfully",
                data,
            });
        } catch (error: any) {
            return handleError(res, error);
        }
    }

    async derive(req: Request, res: Response) {
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
        } catch (error: any) {
            return handleError(res, error);
        }
    }

    async listRecords(req: Request, res: Response) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const data = await service.listRecords(req.query.stagingDetailId as string);

            return res.json({
                success: true,
                message: "Stage records fetched successfully",
                data,
            });
        } catch (error: any) {
            return handleError(res, error);
        }
    }

    async saveRecords(req: Request, res: Response) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const records = (req.body.records as any[]).map((record) => ({
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

            const data = await service.saveRecords(
                {
                    staging_detail_id: req.body.stagingDetailId,
                    replace: req.body.replace,
                    records,
                },
                actingUserId(req)
            );

            return res.json({
                success: true,
                message: "Stage records saved successfully",
                data,
            });
        } catch (error: any) {
            return handleError(res, error);
        }
    }

    async deleteRecord(req: Request, res: Response) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const data = await service.deactivateRecord(
                req.params.stageRecordId as string,
                actingUserId(req)
            );

            return res.json({
                success: true,
                message: "Stage record removed successfully",
                data,
            });
        } catch (error: any) {
            return handleError(res, error);
        }
    }

    async history(req: Request, res: Response) {
        try {
            const errors = firstValidationError(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const data = await service.history(
                req.query.patientId as string,
                (req.query.cancerTypeId as string) || undefined
            );

            return res.json({
                success: true,
                message: "Stage history fetched successfully",
                data,
            });
        } catch (error: any) {
            return handleError(res, error);
        }
    }

}
