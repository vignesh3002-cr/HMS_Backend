import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { ClinicalParameters, StagingDetailFilterQuery } from "./oncology.types";

// The master tables a doctor can add Diagnosis dropdown values to: the id
// column, the id_sequences entity it's generated from, and which of
// display_order / active_status / updated_at the table keeps.
export const REFERENCE_TABLES = {
    anatomical_site_master: { idColumn: "site_id", entity: "ANATOMICAL_SITE", ordered: true, hasActiveStatus: true, hasUpdatedAt: true },
    cancer_subtypes: { idColumn: "subtype_id", entity: "CANCER_SUBTYPE", ordered: false, hasActiveStatus: true, hasUpdatedAt: false },
    staging_reference: { idColumn: "stage_ref_id", entity: "STAGING_REFERENCE", ordered: false, hasActiveStatus: false, hasUpdatedAt: false },
    cancer_grade_master: { idColumn: "grade_id", entity: "CANCER_GRADE", ordered: true, hasActiveStatus: true, hasUpdatedAt: true },
    cancer_score: { idColumn: "score_id", entity: "CANCER_SCORE", ordered: true, hasActiveStatus: true, hasUpdatedAt: true },
    tnm_stage_master: { idColumn: "tnm_id", entity: "TNM_STAGE", ordered: true, hasActiveStatus: true, hasUpdatedAt: true },
    disease_status_master: { idColumn: "disease_status_id", entity: "DISEASE_STATUS", ordered: true, hasActiveStatus: true, hasUpdatedAt: true }
} as const;

export type ReferenceTable = keyof typeof REFERENCE_TABLES;

// Fallback values match prisma/seedOncology.ts's CLINICAL_PARAMETERS exactly -
// used only if a row is somehow missing from the DB, so derivation never
// hard-fails just because the reference seed hasn't been (re)run yet.
const PARAMETER_DEFAULTS: ClinicalParameters = {
    er_pr_positivity_cutoff_pct: 1,
    ki67_luminal_ab_cutoff_pct: 14,
    her2_fish_ratio_cutoff: 2.0,
    her2_fish_avg_copy_cutoff: 6.0,
    pdl1_tps_low_cutoff_pct: 1,
    pdl1_tps_high_cutoff_pct: 50,
    tmb_high_cutoff: 10,
    tnbc_germline_referral_age_years: 50
};

export class OncologyRepository {

    async findCancerTypeByName(cancerType: string) {

        return prisma.cancer_types.findUnique({
            where: { cancer_type: cancerType }
        });

    }

    async findCancerSubtype(cancerTypeId: string, subtypeName: string) {

        return prisma.cancer_subtypes.findFirst({
            where: { cancer_type_id: cancerTypeId, subtype_name: subtypeName }
        });

    }

    // The client design guide requires every numeric clinical threshold to be
    // configurable, not hardcoded (docx Section 11) - this is the single
    // place the derivation engine reads them from.
    async loadClinicalParameters(): Promise<ClinicalParameters> {

        const rows = await prisma.clinical_parameter.findMany();
        const byKey = new Map(rows.map((row) => [row.parameter_key, row.value]));

        const numberOr = (key: keyof ClinicalParameters): number => {

            const raw = byKey.get(key);
            const parsed = raw !== undefined ? Number(raw) : NaN;

            return Number.isFinite(parsed) ? parsed : PARAMETER_DEFAULTS[key];

        };

        return {
            er_pr_positivity_cutoff_pct: numberOr("er_pr_positivity_cutoff_pct"),
            ki67_luminal_ab_cutoff_pct: numberOr("ki67_luminal_ab_cutoff_pct"),
            her2_fish_ratio_cutoff: numberOr("her2_fish_ratio_cutoff"),
            her2_fish_avg_copy_cutoff: numberOr("her2_fish_avg_copy_cutoff"),
            pdl1_tps_low_cutoff_pct: numberOr("pdl1_tps_low_cutoff_pct"),
            pdl1_tps_high_cutoff_pct: numberOr("pdl1_tps_high_cutoff_pct"),
            tmb_high_cutoff: numberOr("tmb_high_cutoff"),
            tnbc_germline_referral_age_years: numberOr("tnbc_germline_referral_age_years")
        };

    }

    // -----------------------------------------------------------------
    // Reference lookups (Phase 4)
    // -----------------------------------------------------------------

    async findCancerTypes() {

        return prisma.cancer_types.findMany({
            where: { active_status: 1 },
            orderBy: { cancer_type: "asc" },
            include:{staging_reference: true}
        });

    }

    async findCancerTypeById(cancerTypeId: string) {

        return prisma.cancer_types.findUnique({ where: { cancer_type_id: cancerTypeId } });

    }

    async findCancerSubtypeById(subtypeId: string) {

        return prisma.cancer_subtypes.findUnique({ where: { subtype_id: subtypeId } });

    }

    async findCancerSubtypesByType(cancerTypeId: string) {

        return prisma.cancer_subtypes.findMany({
            where: { cancer_type_id: cancerTypeId, active_status: 1 },
            orderBy: { subtype_name: "asc" }
        });

    }

    async findStagingReferenceByType(cancerTypeId: string) {

        return prisma.staging_reference.findMany({
            where: { cancer_type_id: cancerTypeId },
            orderBy: { id: "asc" }
        });

    }

    async findBiomarkerTests() {

        return prisma.biomarker_tests.findMany({ orderBy: { biomarker_name: "asc" } });

    }

    async findMolecularSubtypes() {

        return prisma.molecular_subtypes.findMany({ orderBy: { subtype_name: "asc" } });

    }

    async findAnatomicalSitesByType(cancerTypeId: string) {

        return prisma.anatomical_site_master.findMany({
            where: { cancer_type_id: cancerTypeId, active_status: 1 },
            orderBy: [{ display_order: "asc" as const }, { site_name: "asc" as const }]
        });

    }

    async findCancerGradesByType(cancerTypeId: string) {

        return prisma.cancer_grade_master.findMany({
            where: { cancer_type_id: cancerTypeId, active_status: 1 },
            orderBy: [{ display_order: "asc" as const }, { grade_value: "asc" as const }]
        });

    }

    async findCancerScoresByType(cancerTypeId: string) {

        return prisma.cancer_score.findMany({
            where: { cancer_type_id: cancerTypeId, active_status: 1 },
            orderBy: [{ score_system: "asc" as const }, { display_order: "asc" as const }]
        });

    }

    // T / N / M values doctors added for a cancer type, on top of the AJCC
    // values the staging criteria name.
    async findTnmStagesByType(cancerTypeId: string) {

        return prisma.tnm_stage_master.findMany({
            where: { cancer_type_id: cancerTypeId, active_status: 1 },
            orderBy: [{ axis: "asc" as const }, { display_order: "asc" as const }]
        });

    }

    async findDiseaseStatuses() {

        return prisma.disease_status_master.findMany({
            where: { active_status: 1 },
            orderBy: [{ display_order: "asc" as const }, { status_name: "asc" as const }]
        });

    }

    // -----------------------------------------------------------------
    // Values a doctor adds from a Diagnosis dropdown. Each lands in its own
    // master table; these helpers are shared by all of them.
    // -----------------------------------------------------------------

    private referenceDelegate(client: Prisma.TransactionClient | typeof prisma, table: ReferenceTable) {

        return (client as any)[table];

    }

    async findReferenceValue(table: ReferenceTable, where: Record<string, unknown>) {

        return this.referenceDelegate(prisma, table).findFirst({ where });

    }

    async nextReferenceDisplayOrder(table: ReferenceTable, where: Record<string, unknown>): Promise<number> {

        const result = await this.referenceDelegate(prisma, table).aggregate({
            where,
            _max: { display_order: true }
        });

        return (result._max.display_order ?? 0) + 1;

    }

    async createReferenceValue(tx: Prisma.TransactionClient, table: ReferenceTable, data: Record<string, unknown>) {

        return this.referenceDelegate(tx, table).create({ data });

    }

    async reactivateReferenceValue(tx: Prisma.TransactionClient, table: ReferenceTable, id: string) {

        const config = REFERENCE_TABLES[table];

        return this.referenceDelegate(tx, table).update({
            where: { [config.idColumn]: id },
            data: { active_status: 1, ...(config.hasUpdatedAt ? { updated_at: new Date() } : {}) }
        });

    }

    // -----------------------------------------------------------------
    // investigation_parameter / patient_investigation_result - the tests
    // tracked per cancer type and the values entered on each visit.
    // -----------------------------------------------------------------

    async findInvestigationParametersByType(cancerTypeId: string) {

        return prisma.investigation_parameter.findMany({
            where: { cancer_type_id: cancerTypeId, active_status: 1 },
            orderBy: [{ chart_name: "asc" as const }, { display_order: "asc" as const }]
        });

    }

    async findInvestigationParametersByIds(parameterIds: string[]) {

        return prisma.investigation_parameter.findMany({
            where: { parameter_id: { in: parameterIds } }
        });

    }

    async listInvestigationResultsForPatient(patientId: string) {

        // Each result carries its test and the test's cancer type, so the
        // History tab can group the trends per cancer type.
        return prisma.patient_investigation_result.findMany({
            where: { patient_id: patientId },
            include: {
                investigation_parameter: {
                    include: { cancer_types: { select: { cancer_type_id: true, cancer_type: true } } }
                }
            },
            orderBy: [{ report_date: "desc" as const }, { created_at: "desc" as const }]
        });

    }

    async findInvestigationResultsForVisit(tx: Prisma.TransactionClient, encounterNo: string) {

        return tx.patient_investigation_result.findMany({
            where: { encounter_no: encounterNo },
            include: { investigation_parameter: true },
            orderBy: { parameter_id: "asc" as const }
        });

    }

    async createInvestigationResult(
        tx: Prisma.TransactionClient,
        data: Prisma.patient_investigation_resultUncheckedCreateInput
    ) {

        return tx.patient_investigation_result.create({ data });

    }

    async updateInvestigationResult(
        tx: Prisma.TransactionClient,
        investigationResultId: string,
        data: Prisma.patient_investigation_resultUncheckedUpdateInput
    ) {

        return tx.patient_investigation_result.update({
            where: { investigation_result_id: investigationResultId },
            data: { ...data, updated_at: new Date() }
        });

    }

    async deleteInvestigationResults(tx: Prisma.TransactionClient, encounterNo: string, parameterIds: string[]) {

        return tx.patient_investigation_result.deleteMany({
            where: { encounter_no: encounterNo, parameter_id: { in: parameterIds } }
        });

    }

    // -----------------------------------------------------------------
    // Supporting entity lookups (existence checks only - these tables
    // belong to other modules, so no write access here)
    // -----------------------------------------------------------------

    async findPatientById(patientId: string) {

        return prisma.patient_bio_data.findUnique({ where: { patient_id: patientId } });

    }

    async findBranchById(branchId: string) {

        return prisma.branch.findUnique({ where: { branch_id: branchId } });

    }

    async findDiagnosisById(diagnosisId: string) {

        return prisma.diagnosis.findUnique({ where: { diagnosis_id: diagnosisId } });

    }

    async findEncounterByNumber(encounterNo: string) {

        return prisma.encounter.findUnique({ where: { encounter_no: encounterNo } });

    }

    // The staging detail recorded in a visit (one per encounter).
    async findStagingDetailByEncounter(encounterNo: string) {

        return prisma.oncology_staging_detail.findFirst({
            where: { encounter_no: encounterNo },
            select: { staging_detail_id: true }
        });

    }

    async findMostRecentEncounterForPatient(patientId: string) {

        return prisma.encounter.findFirst({
            where: { patient_id: patientId },
            orderBy: { encounter_ts: "desc" }
        });

    }

    // -----------------------------------------------------------------
    // oncology_staging_detail
    // -----------------------------------------------------------------

    async generateStagingDetailId(tx: Prisma.TransactionClient) {

        return generateId(tx, "STAGING_DETAIL");

    }

    async createStagingDetail(tx: Prisma.TransactionClient, data: Prisma.oncology_staging_detailUncheckedCreateInput) {

        return tx.oncology_staging_detail.create({ data });

    }

    async updateStagingDetail(
        tx: Prisma.TransactionClient,
        stagingDetailId: string,
        data: Prisma.oncology_staging_detailUncheckedUpdateInput
    ) {

        return tx.oncology_staging_detail.update({
            where: { staging_detail_id: stagingDetailId },
            data: { ...data, updated_at: new Date() }
        });

    }

    async replaceAdditionalCancers(
        tx: Prisma.TransactionClient,
        stagingDetailId: string,
        cancers: {
            cancer_type_id: string;
            cancer_subtype_id: string | null;
            laterality: string | null;
            t_stage: string | null;
            n_stage: string | null;
            m_stage: string | null;
            histopathology: string | null;
        }[]
    ) {

        await tx.oncology_staging_additional_cancers.deleteMany({
            where: { staging_detail_id: stagingDetailId }
        });

        if (cancers.length > 0) {
            await tx.oncology_staging_additional_cancers.createMany({
                data: cancers.map((cancer, index) => ({
                    staging_detail_id: stagingDetailId,
                    cancer_type_id: cancer.cancer_type_id,
                    cancer_subtype_id: cancer.cancer_subtype_id,
                    laterality: cancer.laterality,
                    t_stage: cancer.t_stage,
                    n_stage: cancer.n_stage,
                    m_stage: cancer.m_stage,
                    histopathology: cancer.histopathology,
                    display_order: index + 1
                }))
            });
        }

    }

    async removeAdditionalCancerType(tx: Prisma.TransactionClient, stagingDetailId: string, cancerTypeId: string) {

        return tx.oncology_staging_additional_cancers.deleteMany({
            where: { staging_detail_id: stagingDetailId, cancer_type_id: cancerTypeId }
        });

    }

    // Only the columns the screens and the ICD cascade read - every staging
    // response carries these, so whole master rows / the patient's bio data
    // (the row already has patient_id) would only add payload.
    private stagingDetailInclude = {
        cancer_types: {
            select: { cancer_type_id: true, cancer_type: true, icd10: true, icd_o3_topography: true, staging_system: true }
        },
        cancer_subtypes: {
            select: { subtype_id: true, subtype_name: true, icd10_subtype: true, icd_o3_morphology: true }
        },
        oncology_staging_additional_cancers: {
            orderBy: { display_order: "asc" as const },
            include: {
                cancer_types: { select: { cancer_type_id: true, cancer_type: true } },
                cancer_subtypes: { select: { subtype_id: true, subtype_name: true } }
            }
        },
        ihc_results: true,
        molecular_results: true,
        derived_fields: true,
        employees: {
            select: { employee_id: true, first_name: true, last_name: true }
        }
    } satisfies Prisma.oncology_staging_detailInclude;

    async findStagingDetailById(stagingDetailId: string) {

        return prisma.oncology_staging_detail.findUnique({
            where: { staging_detail_id: stagingDetailId },
            include: this.stagingDetailInclude
        });

    }

    private stagingDetailWhere(filters: StagingDetailFilterQuery): Prisma.oncology_staging_detailWhereInput {

        return {
            ...(filters.patient_id ? { patient_id: filters.patient_id } : {}),
            ...(filters.diagnosis_id ? { diagnosis_id: filters.diagnosis_id } : {}),
            ...(filters.encounter_no ? { encounter_no: filters.encounter_no } : {}),
            ...(filters.employee_id ? { employee_id: filters.employee_id } : {}),
            ...(filters.branch_id ? { branch_id: filters.branch_id } : {}),
            ...(filters.cancer_type_id ? { cancer_type_id: filters.cancer_type_id } : {}),
            ...(filters.date_from || filters.date_to
                ? {
                    visit_date: {
                        ...(filters.date_from ? { gte: new Date(filters.date_from) } : {}),
                        ...(filters.date_to ? { lte: new Date(filters.date_to) } : {})
                    }
                }
                : {})
        };

    }

    // Newest visit first - a row saved on one day may record an earlier
    // (or, when re-saved, later) visit, so the visit date orders the
    // history, not the save date.
    private stagingDetailOrder: Prisma.oncology_staging_detailOrderByWithRelationInput[] = [
        { visit_date: { sort: "desc", nulls: "last" } },
        { created_at: "desc" }
    ];

    private pageOf(filters: StagingDetailFilterQuery) {

        const page = filters.page && filters.page > 0 ? filters.page : 1;
        const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

        return { page, limit };

    }

    async listStagingDetails(filters: StagingDetailFilterQuery) {

        const { page, limit } = this.pageOf(filters);
        const where = this.stagingDetailWhere(filters);

        const [rows, total] = await Promise.all([
            prisma.oncology_staging_detail.findMany({
                where,
                include: this.stagingDetailInclude,
                orderBy: this.stagingDetailOrder,
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.oncology_staging_detail.count({ where })
        ]);

        return { rows, total, page, limit };

    }

    // The same list, just each row's id and visit (view=ids) - for the
    // lookups that only need to know which row to load or update.
    async listStagingDetailIds(filters: StagingDetailFilterQuery) {

        const { page, limit } = this.pageOf(filters);
        const where = this.stagingDetailWhere(filters);

        const [rows, total] = await Promise.all([
            prisma.oncology_staging_detail.findMany({
                where,
                select: { staging_detail_id: true, encounter_no: true, visit_date: true },
                orderBy: this.stagingDetailOrder,
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.oncology_staging_detail.count({ where })
        ]);

        return { rows, total, page, limit };

    }

    // -----------------------------------------------------------------
    // ihc_results / molecular_results / derived_fields - all 1:1 with
    // oncology_staging_detail (enforced by the uq_*_staging_detail unique
    // constraints), so every write here is an upsert keyed on staging_detail_id.
    // -----------------------------------------------------------------

    async findIhcByStagingDetail(stagingDetailId: string) {

        return prisma.ihc_results.findUnique({ where: { staging_detail_id: stagingDetailId } });

    }

    async findMolecularByStagingDetail(stagingDetailId: string) {

        return prisma.molecular_results.findUnique({ where: { staging_detail_id: stagingDetailId } });

    }

    async findDerivedByStagingDetail(stagingDetailId: string) {

        return prisma.derived_fields.findUnique({ where: { staging_detail_id: stagingDetailId } });

    }

    async upsertIhcResults(
        tx: Prisma.TransactionClient,
        stagingDetailId: string,
        data: Omit<Prisma.ihc_resultsUncheckedCreateInput, "ihc_id" | "staging_detail_id">
    ) {

        const existing = await tx.ihc_results.findUnique({ where: { staging_detail_id: stagingDetailId } });

        if (existing) {

            return tx.ihc_results.update({
                where: { staging_detail_id: stagingDetailId },
                data: { ...data, updated_at: new Date() }
            });

        }

        const ihcId = await generateId(tx, "IHC_RESULT");

        return tx.ihc_results.create({
            data: { ihc_id: ihcId, staging_detail_id: stagingDetailId, ...data }
        });

    }

    async upsertMolecularResults(
        tx: Prisma.TransactionClient,
        stagingDetailId: string,
        data: Omit<Prisma.molecular_resultsUncheckedCreateInput, "mol_id" | "staging_detail_id">
    ) {

        const existing = await tx.molecular_results.findUnique({ where: { staging_detail_id: stagingDetailId } });

        if (existing) {

            return tx.molecular_results.update({
                where: { staging_detail_id: stagingDetailId },
                data: { ...data, updated_at: new Date() }
            });

        }

        const molId = await generateId(tx, "MOLECULAR_RESULT");

        return tx.molecular_results.create({
            data: { mol_id: molId, staging_detail_id: stagingDetailId, ...data }
        });

    }

    async upsertDerivedFields(
        tx: Prisma.TransactionClient,
        stagingDetailId: string,
        data: Omit<Prisma.derived_fieldsUncheckedCreateInput, "derived_id" | "staging_detail_id">
    ) {

        const existing = await tx.derived_fields.findUnique({ where: { staging_detail_id: stagingDetailId } });

        if (existing) {

            return tx.derived_fields.update({
                where: { staging_detail_id: stagingDetailId },
                data: { ...data, derived_at: new Date() }
            });

        }

        const derivedId = await generateId(tx, "DERIVED_FIELD");

        return tx.derived_fields.create({
            data: { derived_id: derivedId, staging_detail_id: stagingDetailId, ...data }
        });

    }

}
