"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genomicsRepository = exports.GenomicsRepository = exports.toGeneMasterRecord = exports.toTestRecord = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const toDateOnly = (value) => {
    if (!value)
        return null;
    return value.toISOString().slice(0, 10);
};
const toResultRecord = (row) => ({
    result_id: row.result_id,
    test_id: row.test_id,
    gene_symbol: row.gene_symbol,
    is_other_gene: row.is_other_gene,
    status: row.status,
    transcript_details: row.transcript_details ?? null,
});
const toTestRecord = (row) => ({
    test_id: row.test_id,
    patient_id: row.patient_id,
    encounter_no: row.encounter_no ?? null,
    staging_detail_id: row.staging_detail_id ?? null,
    branch_id: row.branch_id ?? null,
    sample_type: row.sample_type,
    cancer_site: row.cancer_site,
    report_date: toDateOnly(row.report_date),
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
exports.toTestRecord = toTestRecord;
const toGeneMasterRecord = (row) => ({
    gene_master_id: row.gene_master_id,
    cancer_site: row.cancer_site,
    scope: row.scope,
    gene_symbol: row.gene_symbol,
    sort_order: row.sort_order,
    active: Boolean(row.active),
    source: row.source ?? null,
    spec_site: row.spec_site ?? null,
});
exports.toGeneMasterRecord = toGeneMasterRecord;
class GenomicsRepository {
    // ------------------------------------------------------------------
    // gene_master
    // ------------------------------------------------------------------
    async findCancerSites() {
        const rows = await prisma_1.default.gene_master.findMany({
            where: { active: true },
            select: { cancer_site: true },
            distinct: ["cancer_site"],
            orderBy: { cancer_site: "asc" },
        });
        return rows.map((row) => row.cancer_site);
    }
    async findGenes(cancerSite, scope) {
        const rows = await prisma_1.default.gene_master.findMany({
            where: { cancer_site: cancerSite, scope: scope, active: true },
            select: { gene_symbol: true },
            orderBy: [{ sort_order: "asc" }, { gene_symbol: "asc" }],
        });
        return rows.map((row) => row.gene_symbol);
    }
    async findGene(cancerSite, scope, geneSymbol) {
        return prisma_1.default.gene_master.findFirst({
            where: {
                cancer_site: cancerSite,
                scope: scope,
                gene_symbol: geneSymbol,
            },
        });
    }
    async findCancerSite(cancerSite) {
        return prisma_1.default.gene_master.findFirst({ where: { cancer_site: cancerSite } });
    }
    async listGeneMaster(filters) {
        const where = {};
        if (filters.cancerSite)
            where.cancer_site = filters.cancerSite;
        if (filters.scope)
            where.scope = filters.scope;
        const rows = await prisma_1.default.gene_master.findMany({
            where,
            orderBy: [
                { cancer_site: "asc" },
                { scope: "asc" },
                { sort_order: "asc" },
                { gene_symbol: "asc" },
            ],
        });
        return rows.map(exports.toGeneMasterRecord);
    }
    async createGene(tx, data) {
        const geneMasterId = await (0, idGenerator_1.generateId)(tx, "GENE_MASTER");
        return tx.gene_master.create({
            data: {
                gene_master_id: geneMasterId,
                cancer_site: data.cancer_site,
                scope: data.scope,
                gene_symbol: data.gene_symbol,
                sort_order: data.sort_order,
                source: data.source ?? "Admin",
                spec_site: data.spec_site ?? null,
                active: true,
            },
        });
    }
    async updateGene(tx, geneMasterId, data) {
        return tx.gene_master.update({
            where: { gene_master_id: geneMasterId },
            data: { ...data, updated_at: new Date() },
        });
    }
    async findGeneById(geneMasterId) {
        return prisma_1.default.gene_master.findUnique({ where: { gene_master_id: geneMasterId } });
    }
    /** How many saved gene results use this symbol (any site). */
    async countResultUsage(geneSymbol) {
        return prisma_1.default.genomic_result.count({ where: { gene_symbol: geneSymbol } });
    }
    async deleteGene(tx, geneMasterId) {
        return tx.gene_master.delete({ where: { gene_master_id: geneMasterId } });
    }
    async nextSortOrder(cancerSite, scope) {
        const row = await prisma_1.default.gene_master.findFirst({
            where: { cancer_site: cancerSite, scope: scope },
            orderBy: { sort_order: "desc" },
            select: { sort_order: true },
        });
        return (row?.sort_order ?? 0) + 1;
    }
    // ------------------------------------------------------------------
    // genomic_test / genomic_result
    // ------------------------------------------------------------------
    async patientExists(patientId) {
        const row = await prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId },
            select: { patient_id: true },
        });
        return Boolean(row);
    }
    async findEncounterForPatient(encounterNo, patientId) {
        return prisma_1.default.encounter.findFirst({
            where: { encounter_no: encounterNo, patient_id: patientId },
            select: { encounter_no: true, branch_id: true },
        });
    }
    async findStagingDetailForEncounter(patientId, encounterNo) {
        return prisma_1.default.oncology_staging_detail.findFirst({
            where: { patient_id: patientId, encounter_no: encounterNo },
            select: { staging_detail_id: true },
        });
    }
    async findStagingDetail(stagingDetailId, patientId) {
        return prisma_1.default.oncology_staging_detail.findFirst({
            where: { staging_detail_id: stagingDetailId, patient_id: patientId },
            select: { staging_detail_id: true, encounter_no: true },
        });
    }
    async listTests(patientId, includeDeleted = false) {
        const rows = await prisma_1.default.genomic_test.findMany({
            where: { patient_id: patientId, ...(includeDeleted ? {} : { is_deleted: false }) },
            include: { genomic_result: { orderBy: { id: "asc" } } },
            orderBy: [{ report_date: "desc" }, { created_at: "desc" }],
        });
        return rows.map(exports.toTestRecord);
    }
    async findTest(testId, includeDeleted = false) {
        const row = await prisma_1.default.genomic_test.findFirst({
            where: { test_id: testId, ...(includeDeleted ? {} : { is_deleted: false }) },
            include: { genomic_result: { orderBy: { id: "asc" } } },
        });
        return row ? (0, exports.toTestRecord)(row) : null;
    }
    async findRawTest(testId) {
        return prisma_1.default.genomic_test.findUnique({ where: { test_id: testId } });
    }
    async createTest(tx, data) {
        return tx.genomic_test.create({ data });
    }
    async createResults(tx, rows) {
        if (!rows.length)
            return [];
        const ids = await (0, idGenerator_1.generateIdBatch)(tx, "GENOMIC_RESULT", rows.length);
        return tx.genomic_result.createMany({
            data: rows.map((row, index) => ({ ...row, result_id: ids[index] })),
        });
    }
    async deleteResults(tx, testId) {
        return tx.genomic_result.deleteMany({ where: { test_id: testId } });
    }
    async updateTest(tx, testId, data) {
        return tx.genomic_test.update({
            where: { test_id: testId },
            data: { ...data, updated_at: new Date() },
        });
    }
    async generateTestId(tx) {
        return (0, idGenerator_1.generateId)(tx, "GENOMIC_TEST");
    }
    async findLabs(patientId) {
        const rows = await prisma_1.default.genomic_test.findMany({
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
    async findKeyAlterations(patientId) {
        const rows = await prisma_1.default.genomic_test.findMany({
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
        const out = [];
        for (const row of rows) {
            for (const result of row.genomic_result) {
                out.push({
                    gene_symbol: result.gene_symbol,
                    status: result.status,
                    sample_type: row.sample_type,
                    report_date: toDateOnly(row.report_date),
                    test_id: row.test_id,
                    cancer_site: row.cancer_site,
                });
            }
        }
        return out;
    }
}
exports.GenomicsRepository = GenomicsRepository;
exports.genomicsRepository = new GenomicsRepository();
