import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { OncologyService, OncologyValidationError } from "./oncology.service";

const service = new OncologyService();

function actingUserId(req: Request): string {
    return (req as any).user?.user_id || "SYSTEM";
}

// Tables this module writes to - used to strip the constraint name down to
// just the offending column so the client gets an actionable field name
// instead of the raw "<table>_<column>_check" identifier.
const ONCOLOGY_TABLES = ["ihc_results", "molecular_results", "oncology_staging_detail", "oncology_staging_additional_cancers", "derived_fields"];

function fieldFromConstraintName(constraintName: string): string {

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
function handleError(res: Response, error: any) {

    if (error instanceof OncologyValidationError) {

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

export class OncologyController {

    // ---------------- Reference lookups ----------------

    async getCancerTypes(req: Request, res: Response) {

        try {

            const data = await service.listCancerTypes();
            return res.json({ success: true, message: "Cancer types fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getCancerSubtypes(req: Request, res: Response) {

        try {

            const data = await service.listCancerSubtypes(req.params.cancerTypeId as string);
            return res.json({ success: true, message: "Cancer subtypes fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getStagingReference(req: Request, res: Response) {

        try {

            const data = await service.listStagingReference(req.query.cancer_type_id as string);
            return res.json({ success: true, message: "Staging reference fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getBiomarkerTests(req: Request, res: Response) {

        try {

            const data = await service.listBiomarkerTests();
            return res.json({ success: true, message: "Biomarker tests fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getMolecularSubtypes(req: Request, res: Response) {

        try {

            const data = await service.listMolecularSubtypes();
            return res.json({ success: true, message: "Molecular subtypes fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getAnatomicalSites(req: Request, res: Response) {

        try {

            const data = await service.listAnatomicalSites(req.params.cancerTypeId as string);
            return res.json({ success: true, message: "Anatomical sites fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getCancerGrades(req: Request, res: Response) {

        try {

            const data = await service.listCancerGrades(req.params.cancerTypeId as string);
            return res.json({ success: true, message: "Cancer grades fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getCancerScores(req: Request, res: Response) {

        try {

            const data = await service.listCancerScores(req.params.cancerTypeId as string);
            return res.json({ success: true, message: "Cancer scores fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getInvestigationParameters(req: Request, res: Response) {

        try {

            const data = await service.listInvestigationParameters(req.params.cancerTypeId as string);
            return res.json({ success: true, message: "Investigation tests fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getTnmStages(req: Request, res: Response) {

        try {

            const data = await service.listTnmStages(req.params.cancerTypeId as string);
            return res.json({ success: true, message: "T / N / M stages fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getDiseaseStatuses(req: Request, res: Response) {

        try {

            const data = await service.listDiseaseStatuses();
            return res.json({ success: true, message: "Disease statuses fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Values added from a Diagnosis dropdown ----------------

    // 201 with the new row, or 200 with the row that already had this value.
    private async respondReferenceValue(
        req: Request,
        res: Response,
        label: string,
        add: () => Promise<{ row: any; created: boolean }>
    ) {

        try {

            const errors = validationResult(req);

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

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async addAnatomicalSite(req: Request, res: Response) {

        return this.respondReferenceValue(req, res, "Body site", () =>
            service.addAnatomicalSite(req.params.cancerTypeId as string, req.body.value, actingUserId(req))
        );

    }

    async addCancerSubtype(req: Request, res: Response) {

        return this.respondReferenceValue(req, res, "Histopathology", () =>
            service.addCancerSubtype(req.params.cancerTypeId as string, req.body.value, actingUserId(req))
        );

    }

    async addStagingStage(req: Request, res: Response) {

        return this.respondReferenceValue(req, res, "Cancer stage", () =>
            service.addStagingStage(req.params.cancerTypeId as string, req.body.value, actingUserId(req))
        );

    }

    async addCancerGrade(req: Request, res: Response) {

        return this.respondReferenceValue(req, res, "Grade", () =>
            service.addCancerGrade(req.params.cancerTypeId as string, req.body.value, req.body.system, actingUserId(req))
        );

    }

    async addCancerScore(req: Request, res: Response) {

        return this.respondReferenceValue(req, res, "Score", () =>
            service.addCancerScore(req.params.cancerTypeId as string, req.body.value, req.body.system, actingUserId(req))
        );

    }

    async addTnmStage(req: Request, res: Response) {

        return this.respondReferenceValue(req, res, `${req.body.axis ?? ""} stage`.trim(), () =>
            service.addTnmStage(req.params.cancerTypeId as string, req.body.axis, req.body.value, actingUserId(req))
        );

    }

    async addDiseaseStatus(req: Request, res: Response) {

        return this.respondReferenceValue(req, res, "Disease status", () =>
            service.addDiseaseStatus(req.body.value, actingUserId(req))
        );

    }

    async listInvestigationResults(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const data = await service.listInvestigationResults(req.query.patient_id as string);
            return res.json({ success: true, message: "Investigation results fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async saveInvestigationResults(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const data = await service.saveInvestigationResults(req.body, actingUserId(req));
            return res.json({ success: true, message: "Investigation results saved successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async reseedReference(req: Request, res: Response) {

        try {

            const result = await service.reseedReferenceData();
            return res.json({ success: true, message: result.message });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    // ---------------- Staging detail workflow ----------------

    async createStagingDetail(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

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

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async updateStagingDetail(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const result = await service.updateStagingDetail(
                req.params.stagingDetailId as string,
                req.body,
                actingUserId(req)
            );

            return res.json({
                success: true,
                message: "Staging detail updated successfully",
                warnings: result.warnings,
                data: result.data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getStagingDetail(req: Request, res: Response) {

        try {

            const data = await service.getStagingDetail(req.params.stagingDetailId as string);
            return res.json({ success: true, message: "Staging detail fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async listStagingDetails(req: Request, res: Response) {

        try {

            const result = await service.listStagingDetails({
                patient_id: req.query.patient_id as string | undefined,
                diagnosis_id: req.query.diagnosis_id as string | undefined,
                encounter_no: req.query.encounter_no as string | undefined,
                employee_id: req.query.employee_id as string | undefined,
                branch_id: req.query.branchId as string | undefined,
                cancer_type_id: req.query.cancer_type_id as string | undefined,
                date_from: req.query.date_from as string | undefined,
                date_to: req.query.date_to as string | undefined,
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined
            });

            return res.json({
                success: true,
                message: "Staging details fetched successfully",
                data: result.rows,
                pagination: { total: result.total, page: result.page, limit: result.limit }
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async upsertIhc(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const result = await service.upsertIhc(req.params.stagingDetailId as string, req.body, actingUserId(req));

            return res.json({
                success: true,
                message: "IHC results saved successfully",
                warnings: result.warnings,
                data: result.data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async upsertMolecular(req: Request, res: Response) {

        try {

            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
            }

            const result = await service.upsertMolecular(req.params.stagingDetailId as string, req.body, actingUserId(req));

            return res.json({
                success: true,
                message: "Molecular results saved successfully",
                warnings: result.warnings,
                data: result.data
            });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

    async getDerivedFields(req: Request, res: Response) {

        try {

            const data = await service.getDerivedFields(req.params.stagingDetailId as string);
            return res.json({ success: true, message: "Derived fields fetched successfully", data });

        } catch (error: any) {
            return handleError(res, error);
        }

    }

}
