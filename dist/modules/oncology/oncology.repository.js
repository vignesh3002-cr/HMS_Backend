"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OncologyRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
// Fallback values match prisma/seedOncology.ts's CLINICAL_PARAMETERS exactly -
// used only if a row is somehow missing from the DB, so derivation never
// hard-fails just because the reference seed hasn't been (re)run yet.
const PARAMETER_DEFAULTS = {
    er_pr_positivity_cutoff_pct: 1,
    ki67_luminal_ab_cutoff_pct: 14,
    her2_fish_ratio_cutoff: 2.0,
    her2_fish_avg_copy_cutoff: 6.0,
    pdl1_tps_low_cutoff_pct: 1,
    pdl1_tps_high_cutoff_pct: 50,
    tmb_high_cutoff: 10,
    tnbc_germline_referral_age_years: 50
};
class OncologyRepository {
    async findCancerTypeByName(cancerType) {
        return prisma_1.default.cancer_types.findUnique({
            where: { cancer_type: cancerType }
        });
    }
    async findCancerSubtype(cancerTypeId, subtypeName) {
        return prisma_1.default.cancer_subtypes.findFirst({
            where: { cancer_type_id: cancerTypeId, subtype_name: subtypeName }
        });
    }
    // The client design guide requires every numeric clinical threshold to be
    // configurable, not hardcoded (docx Section 11) - this is the single
    // place the derivation engine reads them from.
    async loadClinicalParameters() {
        const rows = await prisma_1.default.clinical_parameter.findMany();
        const byKey = new Map(rows.map((row) => [row.parameter_key, row.value]));
        const numberOr = (key) => {
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
        return prisma_1.default.cancer_types.findMany({
            where: { active_status: 1 },
            orderBy: { cancer_type: "asc" },
            include: { staging_reference: true }
        });
    }
    async findCancerTypeById(cancerTypeId) {
        return prisma_1.default.cancer_types.findUnique({ where: { cancer_type_id: cancerTypeId } });
    }
    async findCancerSubtypeById(subtypeId) {
        return prisma_1.default.cancer_subtypes.findUnique({ where: { subtype_id: subtypeId } });
    }
    async findCancerSubtypesByType(cancerTypeId) {
        return prisma_1.default.cancer_subtypes.findMany({
            where: { cancer_type_id: cancerTypeId, active_status: 1 },
            orderBy: { subtype_name: "asc" }
        });
    }
    async findStagingReferenceByType(cancerTypeId) {
        return prisma_1.default.staging_reference.findMany({
            where: { cancer_type_id: cancerTypeId },
            orderBy: { id: "asc" }
        });
    }
    async findBiomarkerTests() {
        return prisma_1.default.biomarker_tests.findMany({ orderBy: { biomarker_name: "asc" } });
    }
    async findMolecularSubtypes() {
        return prisma_1.default.molecular_subtypes.findMany({ orderBy: { subtype_name: "asc" } });
    }
    // -----------------------------------------------------------------
    // Supporting entity lookups (existence checks only - these tables
    // belong to other modules, so no write access here)
    // -----------------------------------------------------------------
    async findPatientById(patientId) {
        return prisma_1.default.patient_bio_data.findUnique({ where: { patient_id: patientId } });
    }
    async findBranchById(branchId) {
        return prisma_1.default.branch.findUnique({ where: { branch_id: branchId } });
    }
    async findDiagnosisById(diagnosisId) {
        return prisma_1.default.diagnosis.findUnique({ where: { diagnosis_id: diagnosisId } });
    }
    async findMostRecentEncounterForPatient(patientId) {
        return prisma_1.default.encounter.findFirst({
            where: { patient_id: patientId },
            orderBy: { encounter_ts: "desc" }
        });
    }
    // -----------------------------------------------------------------
    // oncology_staging_detail
    // -----------------------------------------------------------------
    async generateStagingDetailId(tx) {
        return (0, idGenerator_1.generateId)(tx, "STAGING_DETAIL");
    }
    async createStagingDetail(tx, data) {
        return tx.oncology_staging_detail.create({ data });
    }
    async updateStagingDetail(tx, stagingDetailId, data) {
        return tx.oncology_staging_detail.update({
            where: { staging_detail_id: stagingDetailId },
            data: { ...data, updated_at: new Date() }
        });
    }
    stagingDetailInclude = {
        cancer_types: true,
        cancer_subtypes: true,
        ihc_results: true,
        molecular_results: true,
        derived_fields: true,
        patient_bio_data: {
            select: {
                patient_id: true,
                patient_first_name: true,
                patient_last_name: true,
                patient_dob: true,
                patient_age: true,
                patient_gender: true
            }
        },
        employees: {
            select: { employee_id: true, first_name: true, last_name: true }
        }
    };
    async findStagingDetailById(stagingDetailId) {
        return prisma_1.default.oncology_staging_detail.findUnique({
            where: { staging_detail_id: stagingDetailId },
            include: this.stagingDetailInclude
        });
    }
    async listStagingDetails(filters) {
        const page = filters.page && filters.page > 0 ? filters.page : 1;
        const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
        const where = {
            ...(filters.patient_id ? { patient_id: filters.patient_id } : {}),
            ...(filters.diagnosis_id ? { diagnosis_id: filters.diagnosis_id } : {}),
            ...(filters.employee_id ? { employee_id: filters.employee_id } : {}),
            ...(filters.branch_id ? { branch_id: filters.branch_id } : {}),
            ...(filters.cancer_type_id ? { cancer_type_id: filters.cancer_type_id } : {}),
            ...(filters.date_from || filters.date_to
                ? {
                    created_at: {
                        ...(filters.date_from ? { gte: new Date(filters.date_from) } : {}),
                        ...(filters.date_to ? { lte: new Date(filters.date_to) } : {})
                    }
                }
                : {})
        };
        const [rows, total] = await Promise.all([
            prisma_1.default.oncology_staging_detail.findMany({
                where,
                include: this.stagingDetailInclude,
                orderBy: { created_at: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma_1.default.oncology_staging_detail.count({ where })
        ]);
        return { rows, total, page, limit };
    }
    // -----------------------------------------------------------------
    // ihc_results / molecular_results / derived_fields - all 1:1 with
    // oncology_staging_detail (enforced by the uq_*_staging_detail unique
    // constraints), so every write here is an upsert keyed on staging_detail_id.
    // -----------------------------------------------------------------
    async findIhcByStagingDetail(stagingDetailId) {
        return prisma_1.default.ihc_results.findUnique({ where: { staging_detail_id: stagingDetailId } });
    }
    async findMolecularByStagingDetail(stagingDetailId) {
        return prisma_1.default.molecular_results.findUnique({ where: { staging_detail_id: stagingDetailId } });
    }
    async findDerivedByStagingDetail(stagingDetailId) {
        return prisma_1.default.derived_fields.findUnique({ where: { staging_detail_id: stagingDetailId } });
    }
    async upsertIhcResults(tx, stagingDetailId, data) {
        const existing = await tx.ihc_results.findUnique({ where: { staging_detail_id: stagingDetailId } });
        if (existing) {
            return tx.ihc_results.update({
                where: { staging_detail_id: stagingDetailId },
                data: { ...data, updated_at: new Date() }
            });
        }
        const ihcId = await (0, idGenerator_1.generateId)(tx, "IHC_RESULT");
        return tx.ihc_results.create({
            data: { ihc_id: ihcId, staging_detail_id: stagingDetailId, ...data }
        });
    }
    async upsertMolecularResults(tx, stagingDetailId, data) {
        const existing = await tx.molecular_results.findUnique({ where: { staging_detail_id: stagingDetailId } });
        if (existing) {
            return tx.molecular_results.update({
                where: { staging_detail_id: stagingDetailId },
                data: { ...data, updated_at: new Date() }
            });
        }
        const molId = await (0, idGenerator_1.generateId)(tx, "MOLECULAR_RESULT");
        return tx.molecular_results.create({
            data: { mol_id: molId, staging_detail_id: stagingDetailId, ...data }
        });
    }
    async upsertDerivedFields(tx, stagingDetailId, data) {
        const existing = await tx.derived_fields.findUnique({ where: { staging_detail_id: stagingDetailId } });
        if (existing) {
            return tx.derived_fields.update({
                where: { staging_detail_id: stagingDetailId },
                data: { ...data, derived_at: new Date() }
            });
        }
        const derivedId = await (0, idGenerator_1.generateId)(tx, "DERIVED_FIELD");
        return tx.derived_fields.create({
            data: { derived_id: derivedId, staging_detail_id: stagingDetailId, ...data }
        });
    }
}
exports.OncologyRepository = OncologyRepository;
