import prisma from "../../config/prisma";
import { diffFields, logAudit, summarizeCreate } from "../audit/audit.service";
import { AUDIT_ACTION } from "../audit/audit.types";
import {
    GENOMIC_SAMPLE_TYPES,
    GENOMIC_STATUSES,
    MAX_DELETE_REASON_LENGTH,
    MAX_GENE_SYMBOL_LENGTH,
    MAX_LAB_NAME_LENGTH,
    MAX_PANEL_NAME_LENGTH,
    MAX_REMARKS_LENGTH,
    MAX_TRANSCRIPT_LENGTH,
    SAMPLE_TYPE_TO_SCOPE,
} from "./genomics.constants";
import { genomicsRepository, GenomicsRepository } from "./genomics.repository";
import { GenomicFieldError, GenomicTestInput } from "./genomics.types";

export class GenomicValidationError extends Error {
    constructor(public errors: GenomicFieldError[], message = "Validation failed") {
        super(message);
        this.name = "GenomicValidationError";
    }
}

export class GenomicNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GenomicNotFoundError";
    }
}

/* Accepts YYYY-MM-DD (API) and DD-MM-YYYY (the date field's display format)
   and returns a normalised YYYY-MM-DD string, or null when not a real date. */
function toIsoDate(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const text = value.trim();
    let year: number;
    let month: number;
    let day: number;

    let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match) {
        year = Number(match[1]);
        month = Number(match[2]);
        day = Number(match[3]);
    } else {
        match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
        if (!match) return null;
        day = Number(match[1]);
        month = Number(match[2]);
        year = Number(match[3]);
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
    ).padStart(2, "0")}`;
}

function dateToDb(iso: string | null): Date | null {
    return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

function cleanText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

export interface NormalisedTestInput {
    sampleType: string;
    cancerSite: string;
    reportDate: string;
    collectionDate: string | null;
    labName: string | null;
    panelName: string | null;
    reportDocumentId: string | null;
    remarks: string | null;
    results: {
        gene_symbol: string;
        is_other_gene: boolean;
        status: string;
        transcript_details: string | null;
    }[];
}

export class GenomicsService {
    constructor(private repository: GenomicsRepository = genomicsRepository) {}

    // ------------------------------------------------------------------
    // Lookups
    // ------------------------------------------------------------------

    async getCancerSites() {
        return this.repository.findCancerSites();
    }

    async getGenes(cancerSite: string, sampleType: string) {
        const scope = SAMPLE_TYPE_TO_SCOPE[sampleType as keyof typeof SAMPLE_TYPE_TO_SCOPE];
        if (!cancerSite || !scope) {
            throw new GenomicValidationError([
                {
                    field: !cancerSite ? "site" : "sampleType",
                    message: !cancerSite
                        ? "site is required"
                        : `sampleType must be one of: ${GENOMIC_SAMPLE_TYPES.join(", ")}`,
                },
            ]);
        }
        const genes = await this.repository.findGenes(cancerSite, scope);
        return { site: cancerSite, scope, genes, allowOther: true };
    }

    async getLabs(patientId: string) {
        if (!patientId) {
            throw new GenomicValidationError([{ field: "patientId", message: "patientId is required" }]);
        }
        return this.repository.findLabs(patientId);
    }

    async getKeyAlterations(patientId: string) {
        if (!patientId) {
            throw new GenomicValidationError([{ field: "patientId", message: "patientId is required" }]);
        }
        return this.repository.findKeyAlterations(patientId);
    }

    // ------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------

    private async validate(dto: GenomicTestInput, patientId: string): Promise<NormalisedTestInput> {
        const errors: GenomicFieldError[] = [];

        const sampleType = String(dto.sampleType ?? "").trim();
        if (!GENOMIC_SAMPLE_TYPES.includes(sampleType as any)) {
            errors.push({
                field: "sampleType",
                message: `Sample type must be one of: ${GENOMIC_SAMPLE_TYPES.join(", ")}`,
            });
        }

        const cancerSite = String(dto.cancerSite ?? "").trim();
        if (!cancerSite) {
            errors.push({ field: "cancerSite", message: "Cancer site is required" });
        } else if (!(await this.repository.findCancerSite(cancerSite))) {
            errors.push({ field: "cancerSite", message: `Unknown cancer site: ${cancerSite}` });
        }

        const reportDate = toIsoDate(dto.reportDate);
        if (!reportDate) {
            errors.push({ field: "reportDate", message: "Report date is required (DD-MM-YYYY)" });
        } else if (reportDate > todayIso()) {
            errors.push({ field: "reportDate", message: "Report date cannot be in the future" });
        }

        const collectionDate = dto.collectionDate ? toIsoDate(dto.collectionDate) : null;
        if (dto.collectionDate && !collectionDate) {
            errors.push({
                field: "collectionDate",
                message: "Sample collection date must be a valid date (DD-MM-YYYY)",
            });
        } else if (collectionDate && reportDate && collectionDate > reportDate) {
            errors.push({
                field: "collectionDate",
                message: "Sample collection date must be on or before the report date",
            });
        }

        const labName = cleanText(dto.labName);
        if (labName && labName.length > MAX_LAB_NAME_LENGTH) {
            errors.push({
                field: "labName",
                message: `Laboratory must be ${MAX_LAB_NAME_LENGTH} characters or fewer`,
            });
        }

        const panelName = cleanText(dto.panelName);
        if (panelName && panelName.length > MAX_PANEL_NAME_LENGTH) {
            errors.push({
                field: "panelName",
                message: `Panel / test name must be ${MAX_PANEL_NAME_LENGTH} characters or fewer`,
            });
        }

        const remarks = cleanText(dto.remarks);
        if (remarks && remarks.length > MAX_REMARKS_LENGTH) {
            errors.push({
                field: "remarks",
                message: `Remarks must be ${MAX_REMARKS_LENGTH} characters or fewer`,
            });
        }

        const results = Array.isArray(dto.results) ? dto.results : [];
        if (results.length === 0) {
            errors.push({ field: "results", message: "Add at least one gene result" });
        }

        const scope = SAMPLE_TYPE_TO_SCOPE[sampleType as keyof typeof SAMPLE_TYPE_TO_SCOPE];
        const allowedGenes = new Set(
            scope && cancerSite ? await this.repository.findGenes(cancerSite, scope) : []
        );

        const seen = new Map<string, number>();
        const normalisedResults: NormalisedTestInput["results"] = [];

        results.forEach((row, index) => {
            const prefix = `results[${index}]`;
            const geneSymbol = String(row?.geneSymbol ?? "").trim().toUpperCase();
            const isOtherGene = Boolean(row?.isOtherGene);
            const status = String(row?.status ?? "").trim();
            const transcriptRaw = typeof row?.transcriptDetails === "string" ? row.transcriptDetails : null;

            if (!geneSymbol) {
                errors.push({ field: `${prefix}.geneSymbol`, message: "Gene is required" });
            } else if (geneSymbol.length > MAX_GENE_SYMBOL_LENGTH) {
                errors.push({
                    field: `${prefix}.geneSymbol`,
                    message: `Gene symbol must be ${MAX_GENE_SYMBOL_LENGTH} characters or fewer`,
                });
            } else if (!isOtherGene && allowedGenes.size > 0 && !allowedGenes.has(geneSymbol)) {
                errors.push({
                    field: `${prefix}.geneSymbol`,
                    message: `${geneSymbol} is not in the ${cancerSite} gene list for this sample type`,
                });
            }

            if (geneSymbol) {
                if (seen.has(geneSymbol)) {
                    errors.push({
                        field: `${prefix}.geneSymbol`,
                        message: `${geneSymbol} is already in this report`,
                    });
                } else {
                    seen.set(geneSymbol, index);
                }
            }

            if (!GENOMIC_STATUSES.includes(status as any)) {
                errors.push({
                    field: `${prefix}.status`,
                    message: "Status is required (Present, Absent or VUS)",
                });
            }

            if (transcriptRaw && transcriptRaw.length > MAX_TRANSCRIPT_LENGTH) {
                errors.push({
                    field: `${prefix}.transcriptDetails`,
                    message: `Transcript / variant details must be ${MAX_TRANSCRIPT_LENGTH} characters or fewer`,
                });
            }

            if ((status === "PRESENT" || status === "VUS") && !transcriptRaw?.trim()) {
                errors.push({
                    field: `${prefix}.transcriptDetails`,
                    message: "Transcript / variant details are required when status is Present or VUS",
                });
            }

            normalisedResults.push({
                gene_symbol: geneSymbol,
                is_other_gene: isOtherGene,
                status,
                transcript_details: transcriptRaw,
            });
        });

        // The database enforces the same rules; returning the full list here
        // lets the screen highlight every offending row at once.
        if (errors.length) throw new GenomicValidationError(errors);

        return {
            sampleType,
            cancerSite,
            reportDate: reportDate as string,
            collectionDate,
            labName,
            panelName,
            reportDocumentId: cleanText(dto.reportDocumentId),
            remarks,
            results: normalisedResults,
        };
    }

    private async resolveContext(
        patientId: string,
        encounterNo: string | null | undefined,
        stagingDetailId: string | null | undefined
    ) {
        let resolvedEncounterNo = cleanText(encounterNo);
        let branchId: string | null = null;

        if (resolvedEncounterNo) {
            const encounter = await this.repository.findEncounterForPatient(resolvedEncounterNo, patientId);
            if (!encounter) {
                throw new GenomicValidationError([
                    { field: "encounterNo", message: "The encounter does not belong to this patient" },
                ]);
            }
            branchId = encounter.branch_id ?? null;
        }

        let resolvedStagingId: string | null = null;
        const requestedStaging = cleanText(stagingDetailId);

        if (requestedStaging) {
            const staging = await this.repository.findStagingDetail(requestedStaging, patientId);
            if (!staging) {
                throw new GenomicValidationError([
                    {
                        field: "stagingDetailId",
                        message: "The staging detail does not belong to this patient",
                    },
                ]);
            }
            resolvedStagingId = staging.staging_detail_id;
            resolvedEncounterNo = resolvedEncounterNo ?? staging.encounter_no ?? null;
        } else if (resolvedEncounterNo) {
            const staging = await this.repository.findStagingDetailForEncounter(
                patientId,
                resolvedEncounterNo
            );
            resolvedStagingId = staging?.staging_detail_id ?? null;
        }

        return { encounterNo: resolvedEncounterNo, stagingDetailId: resolvedStagingId, branchId };
    }

    // ------------------------------------------------------------------
    // Reports
    // ------------------------------------------------------------------

    async listTests(patientId: string) {
        if (!(await this.repository.patientExists(patientId))) {
            throw new GenomicNotFoundError("Patient not found");
        }
        return this.repository.listTests(patientId);
    }

    async getTest(testId: string, actingUserId: string) {
        const test = await this.repository.findTest(testId);
        if (!test) throw new GenomicNotFoundError("Genomic report not found");

        // Every view of a germline report is written to the audit log.
        if (test.sample_type === "GERMLINE") {
            await prisma.$transaction(async (tx) => {
                await logAudit(tx, {
                    entity_type: "genomic_test",
                    entity_id: test.test_id,
                    action: AUDIT_ACTION.VIEW,
                    performed_by: actingUserId,
                    patient_id: test.patient_id,
                    branch_id: test.branch_id,
                    change_summary: summarizeCreate({
                        sample_type: test.sample_type,
                        cancer_site: test.cancer_site,
                        report_date: test.report_date,
                    }),
                });
            });
        }

        return test;
    }

    async createTest(patientId: string, dto: GenomicTestInput, actingUserId: string) {
        if (!(await this.repository.patientExists(patientId))) {
            throw new GenomicNotFoundError("Patient not found");
        }

        const data = await this.validate(dto, patientId);
        const context = await this.resolveContext(patientId, dto.encounterNo, dto.stagingDetailId);

        const testId = await prisma.$transaction(async (tx) => {
            const generatedId = await this.repository.generateTestId(tx);

            await this.repository.createTest(tx, {
                test_id: generatedId,
                patient_id: patientId,
                encounter_no: context.encounterNo,
                staging_detail_id: context.stagingDetailId,
                branch_id: context.branchId,
                sample_type: data.sampleType as any,
                cancer_site: data.cancerSite,
                report_date: dateToDb(data.reportDate) as Date,
                collection_date: dateToDb(data.collectionDate),
                lab_name: data.labName,
                panel_name: data.panelName,
                report_document_id: data.reportDocumentId,
                remarks: data.remarks,
                is_deleted: false,
                created_by: actingUserId,
                created_at: new Date(),
            });

            await this.repository.createResults(
                tx,
                data.results.map((row) => ({
                    test_id: generatedId,
                    gene_symbol: row.gene_symbol,
                    is_other_gene: row.is_other_gene,
                    status: row.status as any,
                    transcript_details: row.transcript_details,
                    created_at: new Date(),
                }))
            );

            await logAudit(tx, {
                entity_type: "genomic_test",
                entity_id: generatedId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: patientId,
                branch_id: context.branchId,
                change_summary: summarizeCreate({
                    ...data,
                    results: data.results,
                }),
            });

            return generatedId;
        });

        return this.repository.findTest(testId);
    }

    async updateTest(testId: string, dto: GenomicTestInput, actingUserId: string) {
        const existing = await this.repository.findRawTest(testId);
        if (!existing || existing.is_deleted) {
            throw new GenomicNotFoundError("Genomic report not found");
        }

        const data = await this.validate(dto, existing.patient_id);
        const context = await this.resolveContext(
            existing.patient_id,
            dto.encounterNo ?? existing.encounter_no,
            dto.stagingDetailId ?? existing.staging_detail_id
        );
        const before = await this.repository.findTest(testId, true);

        await prisma.$transaction(async (tx) => {
            await this.repository.updateTest(tx, testId, {
                encounter_no: context.encounterNo,
                staging_detail_id: context.stagingDetailId,
                branch_id: context.branchId ?? existing.branch_id,
                sample_type: data.sampleType as any,
                cancer_site: data.cancerSite,
                report_date: dateToDb(data.reportDate) as Date,
                collection_date: dateToDb(data.collectionDate),
                lab_name: data.labName,
                panel_name: data.panelName,
                report_document_id: data.reportDocumentId,
                remarks: data.remarks,
                updated_by: actingUserId,
            });

            await this.repository.deleteResults(tx, testId);
            await this.repository.createResults(
                tx,
                data.results.map((row) => ({
                    test_id: testId,
                    gene_symbol: row.gene_symbol,
                    is_other_gene: row.is_other_gene,
                    status: row.status as any,
                    transcript_details: row.transcript_details,
                    created_at: new Date(),
                }))
            );

            const after = {
                ...data,
                results: data.results,
            };
            await logAudit(tx, {
                entity_type: "genomic_test",
                entity_id: testId,
                action: AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                patient_id: existing.patient_id,
                branch_id: context.branchId ?? existing.branch_id,
                change_summary: diffFields(
                    {
                        ...before,
                        results: before?.genomic_result ?? [],
                    } as any,
                    after as any
                ),
            });
        });

        return this.repository.findTest(testId);
    }

    async deleteTest(testId: string, reason: string, actingUserId: string) {
        const existing = await this.repository.findRawTest(testId);
        if (!existing || existing.is_deleted) {
            throw new GenomicNotFoundError("Genomic report not found");
        }

        const deleteReason = cleanText(reason);
        if (!deleteReason) {
            throw new GenomicValidationError([
                { field: "reason", message: "A reason is required to delete a report" },
            ]);
        }
        if (deleteReason.length > MAX_DELETE_REASON_LENGTH) {
            throw new GenomicValidationError([
                {
                    field: "reason",
                    message: `Reason must be ${MAX_DELETE_REASON_LENGTH} characters or fewer`,
                },
            ]);
        }

        await prisma.$transaction(async (tx) => {
            await this.repository.updateTest(tx, testId, {
                is_deleted: true,
                delete_reason: deleteReason,
                updated_by: actingUserId,
            });

            await logAudit(tx, {
                entity_type: "genomic_test",
                entity_id: testId,
                action: AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                patient_id: existing.patient_id,
                branch_id: existing.branch_id,
                change_summary: diffFields(
                    { is_deleted: false, delete_reason: null },
                    { is_deleted: true, delete_reason: deleteReason }
                ),
            });
        });

        return { test_id: testId, deleted: true };
    }

    // ------------------------------------------------------------------
    // Gene master administration
    // ------------------------------------------------------------------

    async listGeneMaster(filters: { cancerSite?: string; scope?: string }) {
        return this.repository.listGeneMaster(filters);
    }

    async createGene(
        input: {
            cancerSite: string;
            scope: string;
            geneSymbol: string;
            sortOrder?: number;
            source?: string | null;
            specSite?: string | null;
        },
        actingUserId: string
    ) {
        const cancerSite = String(input.cancerSite ?? "").trim();
        const scope = String(input.scope ?? "").trim().toUpperCase();
        const geneSymbol = String(input.geneSymbol ?? "").trim().toUpperCase();

        const errors: GenomicFieldError[] = [];
        if (!cancerSite) errors.push({ field: "cancerSite", message: "Cancer site is required" });
        if (scope !== "SOMATIC" && scope !== "GERMLINE") {
            errors.push({ field: "scope", message: "Scope must be SOMATIC or GERMLINE" });
        }
        if (!geneSymbol) errors.push({ field: "geneSymbol", message: "Gene symbol is required" });
        if (geneSymbol && (/\s/.test(geneSymbol) || geneSymbol.length > MAX_GENE_SYMBOL_LENGTH)) {
            errors.push({
                field: "geneSymbol",
                message: "Gene symbol must be upper case, without spaces, and 50 characters or fewer",
            });
        }
        if (errors.length) throw new GenomicValidationError(errors);

        const existing = await this.repository.findGene(cancerSite, scope, geneSymbol);
        if (existing) {
            throw new GenomicValidationError([
                {
                    field: "geneSymbol",
                    message: `${geneSymbol} already exists for ${cancerSite} (${scope})`,
                },
            ]);
        }

        const sortOrder =
            typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
                ? input.sortOrder
                : await this.repository.nextSortOrder(cancerSite, scope);

        const created = await prisma.$transaction(async (tx) => {
            const row = await this.repository.createGene(tx, {
                cancer_site: cancerSite,
                scope,
                gene_symbol: geneSymbol,
                sort_order: sortOrder,
                source: input.source ?? "Admin",
                spec_site: input.specSite ?? null,
            });
            await logAudit(tx, {
                entity_type: "gene_master",
                entity_id: row.gene_master_id,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({
                    cancer_site: row.cancer_site,
                    scope: row.scope,
                    gene_symbol: row.gene_symbol,
                    sort_order: row.sort_order,
                }),
            });
            return row;
        });

        return {
            gene_master_id: created.gene_master_id,
            cancer_site: created.cancer_site,
            scope: created.scope,
            gene_symbol: created.gene_symbol,
            sort_order: created.sort_order,
            active: created.active,
            source: created.source,
            spec_site: created.spec_site,
        };
    }

    async updateGene(
        geneMasterId: string,
        input: {
            geneSymbol?: string;
            sortOrder?: number;
            active?: boolean;
            cancerSite?: string;
            scope?: string;
        },
        actingUserId: string
    ) {
        const existing = await this.repository.findGeneById(geneMasterId);
        if (!existing) throw new GenomicNotFoundError("Gene not found");

        const changes: Record<string, any> = {};
        if (input.geneSymbol !== undefined) {
            const symbol = String(input.geneSymbol).trim().toUpperCase();
            if (!symbol || /\s/.test(symbol) || symbol.length > MAX_GENE_SYMBOL_LENGTH) {
                throw new GenomicValidationError([
                    {
                        field: "geneSymbol",
                        message: "Gene symbol must be upper case, without spaces, and 50 characters or fewer",
                    },
                ]);
            }
            changes.gene_symbol = symbol;
        }
        if (input.cancerSite !== undefined) {
            const site = String(input.cancerSite).trim();
            if (!site) {
                throw new GenomicValidationError([
                    { field: "cancerSite", message: "Cancer site is required" },
                ]);
            }
            changes.cancer_site = site;
        }
        if (input.scope !== undefined) {
            const scope = String(input.scope).toUpperCase();
            if (scope !== "SOMATIC" && scope !== "GERMLINE") {
                throw new GenomicValidationError([
                    { field: "scope", message: "Scope must be SOMATIC or GERMLINE" },
                ]);
            }
            changes.scope = scope;
        }
        if (input.sortOrder !== undefined) {
            const order = Number(input.sortOrder);
            if (!Number.isFinite(order)) {
                throw new GenomicValidationError([
                    { field: "sortOrder", message: "Order must be a number" },
                ]);
            }
            changes.sort_order = Math.trunc(order);
        }
        if (input.active !== undefined) changes.active = Boolean(input.active);

        if (!Object.keys(changes).length) {
            throw new GenomicValidationError([{ field: "body", message: "Nothing to update" }]);
        }

        const updated = await prisma.$transaction(async (tx) => {
            const row = await this.repository.updateGene(tx, geneMasterId, changes);
            await logAudit(tx, {
                entity_type: "gene_master",
                entity_id: geneMasterId,
                action: AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                change_summary: diffFields(existing, changes),
            });
            return row;
        });

        return {
            gene_master_id: updated.gene_master_id,
            cancer_site: updated.cancer_site,
            scope: updated.scope,
            gene_symbol: updated.gene_symbol,
            sort_order: updated.sort_order,
            active: updated.active,
            source: updated.source,
            spec_site: updated.spec_site,
        };
    }

    /* Removes a gene the admin added by mistake. Genes that already appear in
       a saved report can only be deactivated - deleting them would make the
       master disagree with real patient data. */
    async deleteGene(geneMasterId: string, actingUserId: string) {
        const existing = await this.repository.findGeneById(geneMasterId);
        if (!existing) throw new GenomicNotFoundError("Gene not found");

        const usage = await this.repository.countResultUsage(existing.gene_symbol);
        if (usage > 0) {
            throw new GenomicValidationError([
                {
                    field: "geneMasterId",
                    message: `${existing.gene_symbol} appears in ${usage} saved report${
                        usage === 1 ? "" : "s"
                    } - deactivate it instead of deleting.`,
                },
            ]);
        }

        await prisma.$transaction(async (tx) => {
            await this.repository.deleteGene(tx, geneMasterId);
            await logAudit(tx, {
                entity_type: "gene_master",
                entity_id: geneMasterId,
                action: AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                change_summary: diffFields(
                    {
                        cancer_site: existing.cancer_site,
                        scope: existing.scope,
                        gene_symbol: existing.gene_symbol,
                        sort_order: existing.sort_order,
                        active: existing.active,
                    },
                    { deleted: true }
                ),
            });
        });

        return { gene_master_id: geneMasterId, deleted: true };
    }
}

export const genomicsService = new GenomicsService();
