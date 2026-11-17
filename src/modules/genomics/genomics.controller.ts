import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { Prisma } from "@prisma/client";
import {
    GenomicsService,
    GenomicNotFoundError,
    GenomicValidationError,
    genomicsService,
} from "./genomics.service";

function actingUserId(req: Request): string {
    return (req as any).user?.user_id || "SYSTEM";
}

function handleError(res: Response, error: any) {
    if (error instanceof GenomicValidationError) {
        return res.status(400).json({
            success: false,
            message: error.message,
            errors: error.errors,
        });
    }

    if (error instanceof GenomicNotFoundError) {
        return res.status(404).json({ success: false, message: error.message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique / check constraint violations reach here when the screen
        // missed a rule; the database stays the last line of defence.
        return res.status(400).json({
            success: false,
            message:
                error.code === "P2002"
                    ? "A duplicate value already exists."
                    : error.message.split("\n").pop() || "Could not save this genomic report.",
        });
    }

    return res.status(500).json({
        success: false,
        message: error?.message || "Could not process this genomic report.",
    });
}

export class GenomicsController {
    constructor(private service: GenomicsService = genomicsService) {}

    private checkValidation(req: Request, res: Response): boolean {
        const result = validationResult(req);
        if (!result.isEmpty()) {
            res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: result.array().map((item) => ({
                    field: item.type === "field" ? (item as any).path : "body",
                    message: item.msg,
                })),
            });
            return false;
        }
        return true;
    }

    getCancerSites = async (_req: Request, res: Response) => {
        try {
            const data = await this.service.getCancerSites();
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    getGenes = async (req: Request, res: Response) => {
        if (!this.checkValidation(req, res)) return;
        try {
            const data = await this.service.getGenes(
                String(req.query.site ?? ""),
                String(req.query.sampleType ?? "")
            );
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    getLabs = async (req: Request, res: Response) => {
        try {
            const data = await this.service.getLabs(String(req.query.patientId ?? ""));
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    getKeyAlterations = async (req: Request, res: Response) => {
        try {
            const data = await this.service.getKeyAlterations(String(req.query.patientId ?? ""));
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    listTests = async (req: Request, res: Response) => {
        try {
            const data = await this.service.listTests(String(req.params.patientId));
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    getTest = async (req: Request, res: Response) => {
        try {
            const data = await this.service.getTest(String(req.params.testId), actingUserId(req));
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    createTest = async (req: Request, res: Response) => {
        if (!this.checkValidation(req, res)) return;
        try {
            const data = await this.service.createTest(
                String(req.params.patientId),
                req.body,
                actingUserId(req)
            );
            return res.status(201).json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    updateTest = async (req: Request, res: Response) => {
        if (!this.checkValidation(req, res)) return;
        try {
            const data = await this.service.updateTest(
                String(req.params.testId),
                req.body,
                actingUserId(req)
            );
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    deleteTest = async (req: Request, res: Response) => {
        try {
            const data = await this.service.deleteTest(
                String(req.params.testId),
                String(req.body?.reason ?? ""),
                actingUserId(req)
            );
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    listGeneMaster = async (req: Request, res: Response) => {
        try {
            const data = await this.service.listGeneMaster({
                cancerSite: req.query.site ? String(req.query.site) : undefined,
                scope: req.query.scope ? String(req.query.scope) : undefined,
            });
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    createGene = async (req: Request, res: Response) => {
        if (!this.checkValidation(req, res)) return;
        try {
            const data = await this.service.createGene(
                {
                    cancerSite: String(req.body.cancerSite ?? ""),
                    scope: String(req.body.scope ?? ""),
                    geneSymbol: String(req.body.geneSymbol ?? ""),
                    sortOrder: req.body.sortOrder,
                    source: req.body.source,
                    specSite: req.body.specSite,
                },
                actingUserId(req)
            );
            return res.status(201).json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    updateGene = async (req: Request, res: Response) => {
        try {
            const data = await this.service.updateGene(
                String(req.params.geneMasterId),
                {
                    geneSymbol: req.body.geneSymbol,
                    sortOrder: req.body.sortOrder,
                    active: req.body.active,
                    cancerSite: req.body.cancerSite,
                    scope: req.body.scope,
                },
                actingUserId(req)
            );
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };

    deleteGene = async (req: Request, res: Response) => {
        try {
            const data = await this.service.deleteGene(
                String(req.params.geneMasterId),
                actingUserId(req)
            );
            return res.json({ success: true, data });
        } catch (error: any) {
            return handleError(res, error);
        }
    };
}

export const genomicsController = new GenomicsController();
