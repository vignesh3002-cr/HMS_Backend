import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId, generateIdBatch } from "../../utils/idGenerator";
import {
    GeneMasterRecord,
    GenomicResultRecord,
    GenomicTestRecord,
    KeyAlteration,
} from "./genomics.types";

const toDateOnly = (value: Date | null | undefined): string | null => {
    if (!value) return null;
    return value.toISOString().slice(0, 10);
};

const toResultRecord = (row: any): GenomicResultRecord => ({
    result_id: row.result_id,
    test_id: row.test_id,
    gene_symbol: row.gene_symbol,
    is_other_gene: row.is_other_gene,
    status: row.status,
    transcript_details: row.transcript_details ?? null,
});

export const toTestRecord = (row: any): GenomicTestRecord => ({
    test_id: row.test_id,
    patient_id: row.patient_id,
    encounter_no: row.encounter_no ?? null,
    staging_detail_id: row.staging_detail_id ?? null,
    branch_id: row.branch_id ?? null,
    sample_type: row.sample_type,
    cancer_site: row.cancer_site,
    report_date: toDateOnly(row.report_date) as string,
    collection_date: toDateOnly(row.collection_date),
    lab_name: row.lab_name ?? null,
    panel_name: row.panel_name ?? null,
    report_document_id: row.report_document_id ?? null,
    remarks: row.remarks ?? null,
    is_deleted: Boolean(row.is_deleted),
    delete_reason: row.delete_reason ?? null,
    created_by: row.created_by,
    created_at: row.created_at?.toISOString?.() ?? String(row.created_at ?? ""),
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at?.toISOString?.() ?? null,
    genomic_result: (row.genomic_result ?? []).map(toResultRecord),
});

export const toGeneMasterRecord = (row: any): GeneMasterRecord => ({
    gene_master_id: row.gene_master_id,
    cancer_site: row.cancer_site,
    scope: row.scope,
    gene_symbol: row.gene_symbol,
    sort_order: row.sort_order,
    active: Boolean(row.active),
    source: row.source ?? null,
    spec_site: row.spec_site ?? null,
});

export class GenomicsRepository {
    // ------------------------------------------------------------------
    // gene_master
    // ------------------------------------------------------------------

    async findCancerSites(): Promise<string[]> {
        const rows = await prisma.gene_master.findMany({
            where: { active: true },
            select: { cancer_site: true },
            distinct: ["cancer_site"],
            orderBy: { cancer_site: "asc" },
        });
        return rows.map((row) => row.cancer_site);
    }

    async findGenes(cancerSite: string, scope: string): Promise<string[]> {
        const rows = await prisma.gene_master.findMany({
            where: { cancer_site: cancerSite, scope: scope as any, active: true },
            select: { gene_symbol: true },
            orderBy: [{ sort_order: "asc" }, { gene_symbol: "asc" }],
        });
        return rows.map((row) => row.gene_symbol);
    }

    async findGene(cancerSite: string, scope: string, geneSymbol: string) {
        return prisma.gene_master.findFirst({
            where: {
                cancer_site: cancerSite,
                scope: scope as any,
                gene_symbol: geneSymbol,
            },
        });
    }

    async findCancerSite(cancerSite: string) {
        return prisma.gene_master.findFirst({ where: { cancer_site: cancerSite } });
    }

    async listGeneMaster(filters: { cancerSite?: string; scope?: string }) {
        const where: Prisma.gene_masterWhereInput = {};
        if (filters.cancerSite) where.cancer_site = filters.cancerSite;
        if (filters.scope) where.scope = filters.scope as any;
        const rows = await prisma.gene_master.findMany({
            where,
            orderBy: [
                { cancer_site: "asc" },
                { scope: "asc" },
                { sort_order: "asc" },
                { gene_symbol: "asc" },
            ],
        });
        return rows.map(toGeneMasterRecord);
    }

    async createGene(
        tx: Prisma.TransactionClient,
        data: {
            cancer_site: string;
            scope: string;
            gene_symbol: string;
            sort_order: number;
            source?: string | null;
            spec_site?: string | null;
        }
    ) {
        const geneMasterId = await generateId(tx, "GENE_MASTER");
        return tx.gene_master.create({
            data: {
                gene_master_id: geneMasterId,
                cancer_site: data.cancer_site,
                scope: data.scope as any,
                gene_symbol: data.gene_symbol,
                sort_order: data.sort_order,
                source: data.source ?? "Admin",
                spec_site: data.spec_site ?? null,
                active: true,
            },
        });
    }

    async updateGene(
        tx: Prisma.TransactionClient,
        geneMasterId: string,
        data: Prisma.gene_masterUncheckedUpdateInput
    ) {
        return tx.gene_master.update({
            where: { gene_master_id: geneMasterId },
            data: { ...data, updated_at: new Date() },
        });
    }

    async findGeneById(geneMasterId: string) {
        return prisma.gene_master.findUnique({ where: { gene_master_id: geneMasterId } });
    }

    /** How many saved gene results use this symbol (any site). */
    async countResultUsage(geneSymbol: string) {
        return prisma.genomic_result.count({ where: { gene_symbol: geneSymbol } });
    }

    async deleteGene(tx: Prisma.TransactionClient, geneMasterId: string) {
        return tx.gene_master.delete({ where: { gene_master_id: geneMasterId } });
    }

    async nextSortOrder(cancerSite: string, scope: string) {
        const row = await prisma.gene_master.findFirst({
            where: { cancer_site: cancerSite, scope: scope as any },
            orderBy: { sort_order: "desc" },
            select: { sort_order: true },
        });
        return (row?.sort_order ?? 0) + 1;
    }

    // ------------------------------------------------------------------
    // genomic_test / genomic_result
    // ------------------------------------------------------------------

    async patientExists(patientId: string) {
        const row = await prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId },
            select: { patient_id: true },
        });
        return Boolean(row);
    }

    async findEncounterForPatient(encounterNo: string, patientId: string) {
        return prisma.encounter.findFirst({
            where: { encounter_no: encounterNo, patient_id: patientId },
            select: { encounter_no: true, branch_id: true },
        });
    }

    async findStagingDetailForEncounter(patientId: string, encounterNo: string) {
        return prisma.oncology_staging_detail.findFirst({
            where: { patient_id: patientId, encounter_no: encounterNo },
            select: { staging_detail_id: true },
        });
    }

    async findStagingDetail(stagingDetailId: string, patientId: string) {
        return prisma.oncology_staging_detail.findFirst({
            where: { staging_detail_id: stagingDetailId, patient_id: patientId },
            select: { staging_detail_id: true, encounter_no: true },
        });
    }

    async listTests(patientId: string, includeDeleted = false) {
        const rows = await prisma.genomic_test.findMany({
            where: { patient_id: patientId, ...(includeDeleted ? {} : { is_deleted: false }) },
            include: { genomic_result: { orderBy: { id: "asc" } } },
            orderBy: [{ report_date: "desc" }, { created_at: "desc" }],
        });
        return rows.map(toTestRecord);
    }

    async findTest(testId: string, includeDeleted = false) {
        const row = await prisma.genomic_test.findFirst({
            where: { test_id: testId, ...(includeDeleted ? {} : { is_deleted: false }) },
            include: { genomic_result: { orderBy: { id: "asc" } } },
        });
        return row ? toTestRecord(row) : null;
    }

    async findRawTest(testId: string) {
        return prisma.genomic_test.findUnique({ where: { test_id: testId } });
    }

    async createTest(
        tx: Prisma.TransactionClient,
        data: Prisma.genomic_testUncheckedCreateInput
    ) {
        return tx.genomic_test.create({ data });
    }

    async createResults(
        tx: Prisma.TransactionClient,
        rows: Omit<Prisma.genomic_resultUncheckedCreateInput, "result_id">[]
    ) {
        if (!rows.length) return [];
        const ids = await generateIdBatch(tx, "GENOMIC_RESULT", rows.length);
        return tx.genomic_result.createMany({
            data: rows.map((row, index) => ({ ...row, result_id: ids[index] })),
        });
    }

    async deleteResults(tx: Prisma.TransactionClient, testId: string) {
        return tx.genomic_result.deleteMany({ where: { test_id: testId } });
    }

    async updateTest(
        tx: Prisma.TransactionClient,
        testId: string,
        data: Prisma.genomic_testUncheckedUpdateInput
    ) {
        return tx.genomic_test.update({
            where: { test_id: testId },
            data: { ...data, updated_at: new Date() },
        });
    }

    async generateTestId(tx: Prisma.TransactionClient) {
        return generateId(tx, "GENOMIC_TEST");
    }

    async findLabs(patientId: string): Promise<string[]> {
        const rows = await prisma.genomic_test.findMany({
            where: {
                patient_id: patientId,
                is_deleted: false,
                lab_name: { not: null },
            },
            select: { lab_name: true },
            distinct: ["lab_name"],
            orderBy: { lab_name: "asc" },
        });
        return rows
            .map((row) => row.lab_name?.trim() ?? "")
            .filter((name) => name.length > 0);
    }

    async findKeyAlterations(patientId: string): Promise<KeyAlteration[]> {
        const rows = await prisma.genomic_test.findMany({
            where: { patient_id: patientId, is_deleted: false },
            select: {
                test_id: true,
                sample_type: true,
                cancer_site: true,
                report_date: true,
                genomic_result: {
                    where: { status: "PRESENT" },
                    select: { gene_symbol: true, status: true },
                },
            },
            orderBy: [{ report_date: "desc" }, { created_at: "desc" }],
        });

        const out: KeyAlteration[] = [];
        for (const row of rows) {
            for (const result of row.genomic_result) {
                out.push({
                    gene_symbol: result.gene_symbol,
                    status: result.status as any,
                    sample_type: row.sample_type as any,
                    report_date: toDateOnly(row.report_date) as string,
                    test_id: row.test_id,
                    cancer_site: row.cancer_site,
                });
            }
        }
        return out;
    }
}

export const genomicsRepository = new GenomicsRepository();
