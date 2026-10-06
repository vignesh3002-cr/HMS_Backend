import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId, generateIdBatch } from "../../utils/idGenerator";
import { OncologyRepository, REFERENCE_TABLES, ReferenceTable } from "./oncology.repository";
import { validateOncologyRecord } from "./chemo.validation";
import { deriveOncologyFields, deriveHer2Positive } from "./chemo.derivation";
import {
    ENCOUNTER_OPEN_STATUS,
    ENCOUNTER_RECENCY_WINDOW_DAYS,
    LATERALITY_CANCER_TYPES
} from "./oncology.constants";
import { parseTnmValues } from "./tnm.parser";
import { logAudit, diffFields, summarizeCreate } from "../audit/audit.service";
import { AUDIT_ACTION } from "../audit/audit.types";
import {
    StagingInput,
    IhcInput,
    MolecularInput,
    RuleViolation,
    ClinicalParameters,
    DerivedOncologyFields,
    AdditionalCancerDto,
    CreateStagingDetailDto,
    UpdateStagingDetailDto,
    IhcUpsertDto,
    MolecularUpsertDto,
    StagingDetailFilterQuery,
    SaveInvestigationResultsDto
} from "./oncology.types";

export class OncologyValidationError extends Error {

    violations: RuleViolation[];

    constructor(violations: RuleViolation[]) {

        super("Oncology validation failed");
        this.name = "OncologyValidationError";
        this.violations = violations;

    }

}

// Case-insensitive equality filter for a text column.
const insensitive = (value: string) => ({ equals: value, mode: "insensitive" as const });

// ---------------------------------------------------------------------------
// DB row -> validation/derivation Input mappers. Decimal columns (her2_fish_ratio,
// her2_avg_copy, tmb, ...) are converted to plain numbers here so the pure
// validation/derivation functions never have to deal with Prisma.Decimal -
// every other consumer of IhcInput/MolecularInput just sees plain JS values.
// ---------------------------------------------------------------------------
function mapIhcRowToInput(row: any | null | undefined): IhcInput {

    if (!row) {
        return {};
    }

    return {
        er_status: row.er_status ?? null,
        er_percent: row.er_percent ?? null,
        pr_status: row.pr_status ?? null,
        pr_percent: row.pr_percent ?? null,
        her2_ihc: row.her2_ihc ?? null,
        her2_fish: row.her2_fish ?? null,
        her2_fish_ratio: row.her2_fish_ratio != null ? Number(row.her2_fish_ratio) : null,
        her2_avg_copy: row.her2_avg_copy != null ? Number(row.her2_avg_copy) : null,
        ki67_percent: row.ki67_percent ?? null,
        pdl1_tps: row.pdl1_tps ?? null,
        pdl1_cps: row.pdl1_cps ?? null,
        pdl1_clone: row.pdl1_clone ?? null,
        mmr_mlh1: row.mmr_mlh1 ?? null,
        mmr_msh2: row.mmr_msh2 ?? null,
        mmr_msh6: row.mmr_msh6 ?? null,
        mmr_pms2: row.mmr_pms2 ?? null,
        mmr_overall: row.mmr_overall ?? null,
        p53_ihc: row.p53_ihc ?? null,
        ar_status: row.ar_status ?? null,
        mlh1_methylation: row.mlh1_methylation ?? null
    };

}

function mapMolecularRowToInput(row: any | null | undefined): MolecularInput {

    if (!row) {
        return {};
    }

    return {
        egfr_status: row.egfr_status ?? null,
        egfr_mutation_type: row.egfr_mutation_type ?? null,
        alk_status: row.alk_status ?? null,
        ros1_status: row.ros1_status ?? null,
        kras_g12c: row.kras_g12c ?? null,
        kras_mutation: row.kras_mutation ?? null,
        braf_v600e: row.braf_v600e ?? null,
        brca1_germline: row.brca1_germline ?? null,
        brca2_germline: row.brca2_germline ?? null,
        brca_somatic: row.brca_somatic ?? null,
        msi_status: row.msi_status ?? null,
        tmb: row.tmb != null ? Number(row.tmb) : null
    };

}

function computePatientAge(patient: { patient_age: number | null; patient_dob: Date | null }): number | null {

    if (patient.patient_age != null) {
        return patient.patient_age;
    }

    if (!patient.patient_dob) {
        return null;
    }

    const dob = new Date(patient.patient_dob);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--;
    }

    return age;

}

function computeIcdCascade(
    cancerType: { icd10: string | null; icd_o3_topography: string | null; staging_system: string | null },
    subtype: { icd10_subtype: string | null; icd_o3_morphology: string | null }
) {

    const icd10_code = subtype.icd10_subtype ?? cancerType.icd10 ?? null;
    const icd_o3_topo = cancerType.icd_o3_topography ?? null;
    const icd_o3_morpho = subtype.icd_o3_morphology ?? null;
    const staging_system = cancerType.staging_system ?? null;

    const icdO3Combined = icd_o3_topo && icd_o3_morpho
        ? `${icd_o3_topo} + ${icd_o3_morpho}`
        : (icd_o3_topo ?? icd_o3_morpho ?? null);

    return { icd10_code, icd_o3_topo, icd_o3_morpho, staging_system, icdO3Combined };

}

function jsonOrUndefined(value: string[] | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {

    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return Prisma.JsonNull;
    }

    return value as unknown as Prisma.InputJsonValue;

}

// Only the columns that actually exist on derived_fields - her2_positive is
// intentionally NOT one of them (no such column; see getStagingDetail /
// getDerivedFields, which recompute it live from the stored IHC/FISH values
// instead of persisting a copy that could go stale if clinical_parameter
// thresholds are ever retuned).
function derivedPersistPayload(derived: DerivedOncologyFields) {

    return {
        breast_mol_subtype: derived.breast_mol_subtype,
        ajcc_stage: derived.ajcc_stage,
        icd10_auto: derived.icd10_auto,
        icd_o3_auto: derived.icd_o3_auto,
        pdl1_score_type: derived.pdl1_score_type,
        germline_referral_flag: derived.germline_referral_flag,
        lynch_syndrome_flag: derived.lynch_syndrome_flag,
        suggested_therapy: derived.suggested_therapy
    };

}

export class OncologyService {

    private repository = new OncologyRepository();

    // ---------------------------------------------------------------
    // Reference lookups
    // ---------------------------------------------------------------

    async listCancerTypes() {

        const types = await this.repository.findCancerTypes();

        // Laterality is only asked for paired-organ cancers (Section 6.2).
        return types.map((type) => ({
            ...type,
            laterality_applicable: LATERALITY_CANCER_TYPES.includes(type.cancer_type)
        }));

    }

    async listCancerSubtypes(cancerTypeId: string) {

        const cancerType = await this.repository.findCancerTypeById(cancerTypeId);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        return this.repository.findCancerSubtypesByType(cancerTypeId);

    }

    async listStagingReference(cancerTypeId: string) {

        const cancerType = await this.repository.findCancerTypeById(cancerTypeId);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        const rows = await this.repository.findStagingReferenceByType(cancerTypeId);

        // The individual, storable T / N / M values each criteria phrase
        // names - the Diagnosis T / N / M dropdowns are built from these.
        return rows.map((row) => ({ ...row, ...parseTnmValues(row.tnm_criteria) }));

    }

    async listBiomarkerTests() {

        return this.repository.findBiomarkerTests();

    }

    async listMolecularSubtypes() {

        return this.repository.findMolecularSubtypes();

    }

    async listAnatomicalSites(cancerTypeId: string) {

        const cancerType = await this.repository.findCancerTypeById(cancerTypeId);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        return this.repository.findAnatomicalSitesByType(cancerTypeId);

    }

    async listCancerGrades(cancerTypeId: string) {

        const cancerType = await this.repository.findCancerTypeById(cancerTypeId);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        return this.repository.findCancerGradesByType(cancerTypeId);

    }

    async listCancerScores(cancerTypeId: string) {

        const cancerType = await this.repository.findCancerTypeById(cancerTypeId);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        return this.repository.findCancerScoresByType(cancerTypeId);

    }

    async listTnmStages(cancerTypeId: string) {

        await this.requireCancerType(cancerTypeId);

        return this.repository.findTnmStagesByType(cancerTypeId);

    }

    async listDiseaseStatuses() {

        return this.repository.findDiseaseStatuses();

    }

    // ---------------------------------------------------------------
    // Values a doctor adds from a Diagnosis dropdown (Body Site,
    // Histopathology, Cancer Stage, Grade, Score, T / N / M - per cancer
    // type - and Disease Status). Each is stored in its master table, so it
    // is offered for every patient from then on.
    // ---------------------------------------------------------------

    private async requireCancerType(cancerTypeId: string) {

        const cancerType = await this.repository.findCancerTypeById(cancerTypeId);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        return cancerType;

    }

    // The same value (any letter case) already there is returned instead of
    // a duplicate row - re-activated first if it had been retired.
    private async addReferenceValue(
        table: ReferenceTable,
        match: Record<string, unknown>,
        build: () => Promise<Record<string, unknown>>,
        actingUserId: string
    ): Promise<{ row: any; created: boolean }> {

        const config = REFERENCE_TABLES[table];
        const existing = await this.repository.findReferenceValue(table, match);

        if (existing) {

            if (!config.hasActiveStatus || existing.active_status === 1) {
                return { row: existing, created: false };
            }

            const entityId = existing[config.idColumn] as string;
            const row = await prisma.$transaction(async (tx) => {

                const updated = await this.repository.reactivateReferenceValue(tx, table, entityId);

                await logAudit(tx, {
                    entity_type: table,
                    entity_id: entityId,
                    action: AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    change_summary: diffFields(existing, { active_status: 1 })
                });

                return updated;

            });

            return { row, created: true };

        }

        const fields = await build();
        const row = await prisma.$transaction(async (tx) => {

            const entityId = await generateId(tx, config.entity);
            const created = await this.repository.createReferenceValue(tx, table, {
                [config.idColumn]: entityId,
                ...fields,
                ...(config.hasActiveStatus ? { active_status: 1 } : {}),
                created_by: actingUserId
            });

            await logAudit(tx, {
                entity_type: table,
                entity_id: entityId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate(fields)
            });

            return created;

        }, { timeout: 20000 });

        return { row, created: true };

    }

    async addAnatomicalSite(cancerTypeId: string, value: string, actingUserId: string) {

        await this.requireCancerType(cancerTypeId);
        const siteName = value.trim();

        return this.addReferenceValue(
            "anatomical_site_master",
            { cancer_type_id: cancerTypeId, site_name: insensitive(siteName) },
            async () => ({
                cancer_type_id: cancerTypeId,
                site_name: siteName,
                display_order: await this.repository.nextReferenceDisplayOrder("anatomical_site_master", { cancer_type_id: cancerTypeId })
            }),
            actingUserId
        );

    }

    async addCancerSubtype(cancerTypeId: string, value: string, actingUserId: string) {

        await this.requireCancerType(cancerTypeId);
        const subtypeName = value.trim();

        return this.addReferenceValue(
            "cancer_subtypes",
            { cancer_type_id: cancerTypeId, subtype_name: insensitive(subtypeName) },
            async () => ({ cancer_type_id: cancerTypeId, subtype_name: subtypeName }),
            actingUserId
        );

    }

    // A Cancer Stage is a staging_reference row with just its label (and
    // the cancer type's staging system); it names no TNM criteria.
    async addStagingStage(cancerTypeId: string, value: string, actingUserId: string) {

        const cancerType = await this.requireCancerType(cancerTypeId);
        const stageLabel = value.trim();

        return this.addReferenceValue(
            "staging_reference",
            { cancer_type_id: cancerTypeId, stage_label: insensitive(stageLabel) },
            async () => ({
                cancer_type_id: cancerTypeId,
                stage_label: stageLabel,
                staging_system: cancerType.staging_system ?? null
            }),
            actingUserId
        );

    }

    // The Grade list shows the value alone, so one value per cancer type
    // whatever its system.
    async addCancerGrade(cancerTypeId: string, value: string, system: string, actingUserId: string) {

        await this.requireCancerType(cancerTypeId);
        const gradeValue = value.trim();

        return this.addReferenceValue(
            "cancer_grade_master",
            { cancer_type_id: cancerTypeId, grade_value: insensitive(gradeValue) },
            async () => ({
                cancer_type_id: cancerTypeId,
                grade_system: system.trim(),
                grade_value: gradeValue,
                display_order: await this.repository.nextReferenceDisplayOrder("cancer_grade_master", { cancer_type_id: cancerTypeId })
            }),
            actingUserId
        );

    }

    // Scores are listed per score system, so the value is unique within
    // its system (uq_cancer_score_value).
    async addCancerScore(cancerTypeId: string, value: string, system: string, actingUserId: string) {

        await this.requireCancerType(cancerTypeId);
        const scoreValue = value.trim();
        const scoreSystem = system.trim();

        return this.addReferenceValue(
            "cancer_score",
            {
                cancer_type_id: cancerTypeId,
                score_system: insensitive(scoreSystem),
                score_value: insensitive(scoreValue)
            },
            async () => ({
                cancer_type_id: cancerTypeId,
                score_system: scoreSystem,
                score_value: scoreValue,
                display_order: await this.repository.nextReferenceDisplayOrder("cancer_score", {
                    cancer_type_id: cancerTypeId,
                    score_system: scoreSystem
                })
            }),
            actingUserId
        );

    }

    async addTnmStage(cancerTypeId: string, axis: string, value: string, actingUserId: string) {

        await this.requireCancerType(cancerTypeId);
        const stageAxis = axis.toUpperCase();
        // "t4c" -> "T4c": the axis letter is always upper case.
        const trimmed = value.trim();
        const stageValue = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

        if (stageValue.charAt(0) !== stageAxis) {
            throw new Error(`${stageAxis} stage values must start with "${stageAxis}"`);
        }

        return this.addReferenceValue(
            "tnm_stage_master",
            { cancer_type_id: cancerTypeId, axis: stageAxis, stage_value: insensitive(stageValue) },
            async () => ({
                cancer_type_id: cancerTypeId,
                axis: stageAxis,
                stage_value: stageValue,
                display_order: await this.repository.nextReferenceDisplayOrder("tnm_stage_master", {
                    cancer_type_id: cancerTypeId,
                    axis: stageAxis
                })
            }),
            actingUserId
        );

    }

    async addDiseaseStatus(value: string, actingUserId: string) {

        const statusName = value.trim();

        return this.addReferenceValue(
            "disease_status_master",
            { status_name: insensitive(statusName) },
            async () => ({
                status_name: statusName,
                display_order: await this.repository.nextReferenceDisplayOrder("disease_status_master", {})
            }),
            actingUserId
        );

    }

    // ---------------------------------------------------------------
    // Investigation Results (Diagnosis tab): the tests tracked for each
    // cancer type, and their values entered on every visit.
    // ---------------------------------------------------------------

    async listInvestigationParameters(cancerTypeId: string) {

        const cancerType = await this.repository.findCancerTypeById(cancerTypeId);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        return this.repository.findInvestigationParametersByType(cancerTypeId);

    }

    // Every visit's results for the patient, newest report first.
    async listInvestigationResults(patientId: string) {

        return this.repository.listInvestigationResultsForPatient(patientId);

    }

    // Saves a visit's results: each test is upserted by encounter + test;
    // a blank value clears it. Values are checked against the test's type,
    // and a number outside the normal range is flagged abnormal.
    async saveInvestigationResults(dto: SaveInvestigationResultsDto, actingUserId: string) {

        const patient = await this.repository.findPatientById(dto.patient_id);

        if (!patient) {
            throw new Error("Patient not found");
        }

        const encounter = await this.repository.findEncounterByNumber(dto.encounter_no);

        if (!encounter || encounter.patient_id !== dto.patient_id) {
            throw new Error("The encounter does not belong to this patient");
        }

        if (dto.staging_detail_id) {

            const staging = await this.repository.findStagingDetailById(dto.staging_detail_id);

            if (!staging || staging.patient_id !== dto.patient_id) {
                throw new Error("The staging detail does not belong to this patient");
            }

        }

        const reportDate = new Date(dto.report_date);

        if (Number.isNaN(reportDate.getTime())) {
            throw new Error("Report date must be a valid date");
        }

        const results = dto.results ?? [];
        const parameterIds = [...new Set(results.map((result) => result.parameter_id))];

        if (parameterIds.length !== results.length) {
            throw new Error("Each test can only be given once per visit");
        }

        const parameters = await this.repository.findInvestigationParametersByIds(parameterIds);
        const parameterById = new Map(parameters.map((parameter) => [parameter.parameter_id, parameter]));

        type PreparedResult = {
            parameter_id: string;
            value_text: string;
            value_numeric: number | null;
            is_abnormal: boolean;
        };

        const cleared: string[] = [];
        const prepared: PreparedResult[] = [];

        for (const result of results) {

            const parameter = parameterById.get(result.parameter_id);

            if (!parameter || parameter.active_status !== 1) {
                throw new Error(`Investigation test not found: ${result.parameter_id}`);
            }

            const text = result.value === null || result.value === undefined ? "" : String(result.value).trim();

            if (!text) {
                cleared.push(parameter.parameter_id);
                continue;
            }

            if (parameter.input_type === "NUMBER") {

                const value = Number(text);

                if (!Number.isFinite(value)) {
                    throw new Error(`${parameter.parameter_name} must be a number`);
                }

                const min = parameter.normal_min != null ? Number(parameter.normal_min) : null;
                const max = parameter.normal_max != null ? Number(parameter.normal_max) : null;

                prepared.push({
                    parameter_id: parameter.parameter_id,
                    value_text: text,
                    value_numeric: value,
                    is_abnormal: (min !== null && value < min) || (max !== null && value > max)
                });

                continue;

            }

            if (parameter.input_type === "DATE") {

                const date = new Date(text);

                if (!/^\d{4}-\d{2}-\d{2}/.test(text) || Number.isNaN(date.getTime())) {
                    throw new Error(`${parameter.parameter_name} must be a valid date`);
                }

                prepared.push({ parameter_id: parameter.parameter_id, value_text: text.slice(0, 10), value_numeric: null, is_abnormal: false });
                continue;

            }

            if (parameter.input_type === "SELECT" && parameter.select_options) {

                const options = parameter.select_options.split("|").map((option) => option.trim());

                if (!options.includes(text)) {
                    throw new Error(`${parameter.parameter_name} must be one of: ${options.join(", ")}`);
                }

            }

            prepared.push({ parameter_id: parameter.parameter_id, value_text: text, value_numeric: null, is_abnormal: false });

        }

        return prisma.$transaction(async (tx) => {

            const existing = await this.repository.findInvestigationResultsForVisit(tx, dto.encounter_no);
            const existingByParameter = new Map(existing.map((row) => [row.parameter_id, row]));

            if (cleared.length > 0) {
                await this.repository.deleteInvestigationResults(tx, dto.encounter_no, cleared);
            }

            const toCreate = prepared.filter((row) => !existingByParameter.has(row.parameter_id));
            const newIds = await generateIdBatch(tx, "INVESTIGATION_RESULT", toCreate.length);

            for (const row of prepared) {

                const current = existingByParameter.get(row.parameter_id);
                const values = {
                    staging_detail_id: dto.staging_detail_id ?? current?.staging_detail_id ?? null,
                    report_date: reportDate,
                    value_text: row.value_text,
                    value_numeric: row.value_numeric,
                    is_abnormal: row.is_abnormal
                };

                if (current) {
                    await this.repository.updateInvestigationResult(tx, current.investigation_result_id, values);
                } else {
                    await this.repository.createInvestigationResult(tx, {
                        investigation_result_id: newIds[toCreate.indexOf(row)],
                        patient_id: dto.patient_id,
                        encounter_no: dto.encounter_no,
                        parameter_id: row.parameter_id,
                        created_by: actingUserId,
                        ...values
                    });
                }

            }

            if (prepared.length > 0 || cleared.length > 0) {

                await logAudit(tx, {
                    entity_type: "patient_investigation_result",
                    entity_id: dto.encounter_no,
                    action: AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: dto.patient_id,
                    branch_id: encounter.branch_id ?? null,
                    change_summary: summarizeCreate({
                        report_date: dto.report_date,
                        saved: prepared.map((row) => `${row.parameter_id}=${row.value_text}`).join(", "),
                        cleared: cleared.join(", ")
                    })
                });

            }

            return this.repository.findInvestigationResultsForVisit(tx, dto.encounter_no);

        }, { timeout: 20000 });

    }

    // prisma/seedOncology.ts lives outside src/'s tsconfig rootDir (it's a
    // shared CLI + service entry point, not part of the compiled app), so
    // it's loaded via require() here instead of a static TS import - ts-node
    // resolves that fine at runtime without tripping tsc's rootDir check.
    async reseedReferenceData() {

        const seedModule = require("../../../prisma/seedOncology") as {
            seedOncologyReferenceData: () => Promise<void>;
        };

        await seedModule.seedOncologyReferenceData();

        return { message: "Oncology reference data reseeded successfully" };

    }

    // ---------------------------------------------------------------
    // Staging detail workflow
    // ---------------------------------------------------------------

    private async resolveCancerTypeAndSubtype(cancerTypeId: string, cancerSubtypeId: string) {

        const cancerType = await this.repository.findCancerTypeById(cancerTypeId);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        const subtype = await this.repository.findCancerSubtypeById(cancerSubtypeId);

        if (!subtype) {
            throw new Error("Cancer subtype not found");
        }

        if (subtype.cancer_type_id !== cancerTypeId) {
            throw new Error("Selected subtype does not belong to the selected cancer type");
        }

        return { cancerType, subtype };

    }

    // Laterality is only recorded for paired-organ cancers.
    private assertLateralityApplies(cancerTypeName: string, laterality: string | null | undefined) {

        if (laterality && laterality !== "NA" && !LATERALITY_CANCER_TYPES.includes(cancerTypeName)) {
            throw new Error(`Laterality does not apply to ${cancerTypeName}`);
        }

    }

    // Secondary cancer types of a multi-type diagnosis. Each must exist,
    // differ from the primary type and appear once; its optional subtype
    // must belong to it.
    private async resolveAdditionalCancers(primaryCancerTypeId: string, list: AdditionalCancerDto[]) {

        const seen = new Set<string>();
        const rows: {
            cancer_type_id: string;
            cancer_subtype_id: string | null;
            laterality: string | null;
            t_stage: string | null;
            n_stage: string | null;
            m_stage: string | null;
            histopathology: string | null;
        }[] = [];

        for (const entry of list) {

            const cancerType = await this.repository.findCancerTypeById(entry.cancer_type_id);

            if (!cancerType) {
                throw new Error(`Cancer type not found: ${entry.cancer_type_id}`);
            }

            if (entry.cancer_type_id === primaryCancerTypeId) {
                throw new Error(`${cancerType.cancer_type} is already the primary cancer type`);
            }

            if (seen.has(entry.cancer_type_id)) {
                throw new Error(`${cancerType.cancer_type} is selected more than once`);
            }

            seen.add(entry.cancer_type_id);

            let subtypeId: string | null = null;

            if (entry.cancer_subtype_id) {

                const subtype = await this.repository.findCancerSubtypeById(entry.cancer_subtype_id);

                if (!subtype) {
                    throw new Error("Cancer subtype not found");
                }

                if (subtype.cancer_type_id !== entry.cancer_type_id) {
                    throw new Error(`Selected subtype does not belong to ${cancerType.cancer_type}`);
                }

                subtypeId = subtype.subtype_id;

            }

            this.assertLateralityApplies(cancerType.cancer_type, entry.laterality);

            rows.push({
                cancer_type_id: entry.cancer_type_id,
                cancer_subtype_id: subtypeId,
                laterality: entry.laterality || null,
                t_stage: entry.t_stage || null,
                n_stage: entry.n_stage || null,
                m_stage: entry.m_stage || null,
                histopathology: entry.histopathology?.trim() || null
            });

        }

        return rows;

    }

    // A staging detail may only be recorded for a patient who has actually
    // been seen: their most recent encounter must be OPEN, or closed but
    // still within ENCOUNTER_RECENCY_WINDOW_DAYS (covers biopsy/pathology
    // results landing after the ordering visit was closed out). Returns the
    // qualifying encounter so callers can default employee_id (consulting
    // oncologist) to whoever actually saw the patient in that encounter.
    private async resolveQualifyingEncounter(patientId: string) {

        const encounter = await this.repository.findMostRecentEncounterForPatient(patientId);

        if (!encounter) {
            throw new Error("Patient has no encounter on record. An encounter must exist before an oncology diagnosis can be recorded.");
        }

        if (encounter.status === ENCOUNTER_OPEN_STATUS) {
            return encounter;
        }

        const ageDays = (Date.now() - new Date(encounter.encounter_ts).getTime()) / (1000 * 60 * 60 * 24);

        if (ageDays > ENCOUNTER_RECENCY_WINDOW_DAYS) {
            throw new Error(
                `Patient's most recent encounter (${encounter.encounter_no}) is closed and older than ${ENCOUNTER_RECENCY_WINDOW_DAYS} days. Open a new encounter before recording an oncology diagnosis.`
            );
        }

        return encounter;

    }

    async createStagingDetail(dto: CreateStagingDetailDto, actingUserId: string) {

        const patient = await this.repository.findPatientById(dto.patient_id);

        if (!patient) {
            throw new Error("Patient not found");
        }

        const encounter = await this.resolveQualifyingEncounter(dto.patient_id);

        // The visit this diagnosis is recorded in: the one named (it must be
        // this patient's), else the qualifying encounter. One staging detail
        // per visit - re-saving in the same visit updates that row.
        let encounterNo = encounter.encounter_no;

        if (dto.encounter_no && dto.encounter_no !== encounter.encounter_no) {

            const named = await this.repository.findEncounterByNumber(dto.encounter_no);

            if (!named || named.patient_id !== dto.patient_id) {
                throw new Error("The encounter does not belong to this patient");
            }

            encounterNo = named.encounter_no;

        }

        const existingForVisit = await this.repository.findStagingDetailByEncounter(encounterNo);

        if (existingForVisit) {
            throw new Error(
                `This visit (${encounterNo}) already has a staging detail (${existingForVisit.staging_detail_id}) - update it instead`
            );
        }

        const { cancerType, subtype } = await this.resolveCancerTypeAndSubtype(dto.cancer_type_id, dto.cancer_subtype_id);

        this.assertLateralityApplies(cancerType.cancer_type, dto.laterality);

        const additionalCancers = await this.resolveAdditionalCancers(dto.cancer_type_id, dto.additional_cancers ?? []);

        const diagnosis = dto.diagnosis_id
            ? await this.repository.findDiagnosisById(dto.diagnosis_id)
            : null;

        if (dto.diagnosis_id && !diagnosis) {
            throw new Error("Diagnosis not found");
        }

        if (dto.branch_id) {

            const branch = await this.repository.findBranchById(dto.branch_id);

            if (!branch) {
                throw new Error("Branch not found");
            }

        }

        const cascade = computeIcdCascade(cancerType, subtype);

        const staging: StagingInput = {
            cancer_type: cancerType.cancer_type,
            clinical_stage: dto.clinical_stage ?? null,
            t_stage: dto.t_stage ?? null,
            n_stage: dto.n_stage ?? null,
            m_stage: dto.m_stage ?? null,
            metastasis_sites: dto.metastasis_sites ?? null,
            laterality: dto.laterality ?? null,
            site: dto.site ?? null,
            grade: dto.grade ?? null,
            grade_system: dto.grade_system ?? null,
            pre_diagnosis: dto.pre_diagnosis ?? null,
            disease_status: dto.disease_status ?? null
        };

        const ihc: IhcInput = { ...(dto.ihc ?? {}) };
        const molecular: MolecularInput = { ...(dto.molecular ?? {}) };

        const validation = validateOncologyRecord(staging, ihc, molecular);

        if (validation.hardErrors.length > 0) {
            throw new OncologyValidationError(validation.hardErrors);
        }

        const patientAgeYears = computePatientAge(patient);
        const params = await this.repository.loadClinicalParameters();

        const derived = deriveOncologyFields(
            staging,
            ihc,
            molecular,
            { patientAgeYears, icd10FromSubtype: cascade.icd10_code, icdO3FromSubtype: cascade.icdO3Combined },
            params
        );

        const stagingDetailId = await prisma.$transaction(async (tx) => {

            const newId = await this.repository.generateStagingDetailId(tx);

            await this.repository.createStagingDetail(tx, {
                staging_detail_id: newId,
                patient_id: dto.patient_id,
                patient_history_id: dto.patient_history_id ?? null,
                diagnosis_id: dto.diagnosis_id ?? null,
                encounter_no: encounterNo,
                visit_date: dto.visit_date ? new Date(dto.visit_date) : null,
                diagnosis_date: dto.diagnosis_date ? new Date(dto.diagnosis_date) : null,
                progression_date: dto.progression_date ? new Date(dto.progression_date) : null,
                relapse_date: dto.relapse_date ? new Date(dto.relapse_date) : null,
                second_primary_date: dto.second_primary_date ? new Date(dto.second_primary_date) : null,
                biopsy_date: dto.biopsy_date ? new Date(dto.biopsy_date) : null,
                consulting_oncologist: dto.consulting_oncologist ?? null,
                cancer_type_id: dto.cancer_type_id,
                cancer_subtype_id: dto.cancer_subtype_id,
                histopathology: dto.histopathology?.trim() || null,
                icd10_code: cascade.icd10_code,
                icd_o3_topo: cascade.icd_o3_topo,
                icd_o3_morpho: cascade.icd_o3_morpho,
                staging_system: cascade.staging_system,
                clinical_stage: dto.clinical_stage ?? null,
                t_stage: dto.t_stage ?? null,
                n_stage: dto.n_stage ?? null,
                m_stage: dto.m_stage ?? null,
                metastasis_sites: jsonOrUndefined(dto.metastasis_sites) ?? Prisma.JsonNull,
                laterality: dto.laterality ?? null,
                pre_diagnosis: dto.pre_diagnosis ?? null,
                disease_status: dto.disease_status ?? null,
                site: dto.site ?? null,
                grade: dto.grade ?? null,
                grade_system: dto.grade_system ?? null,
                score: dto.score ?? null,
                score_system: dto.score_system ?? null,
                notes: dto.notes ?? null,
                performance_status: dto.performance_status ?? null,
                // Default to whoever actually saw the patient in the
                // qualifying encounter, unless the caller explicitly names
                // a different consulting oncologist/branch.
                employee_id: dto.employee_id ?? encounter.employee_id ?? null,
                branch_id: dto.branch_id ?? encounter.branch_id ?? null,
                user_id: actingUserId
            });

            if (additionalCancers.length > 0) {
                await this.repository.replaceAdditionalCancers(tx, newId, additionalCancers);
            }

            if (dto.ihc) {
                await this.repository.upsertIhcResults(tx, newId, dto.ihc);
            }

            if (dto.molecular) {
                await this.repository.upsertMolecularResults(tx, newId, dto.molecular);
            }

            await this.repository.upsertDerivedFields(tx, newId, derivedPersistPayload(derived));

            await logAudit(tx, {
                entity_type: "oncology_staging_detail",
                entity_id: newId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: dto.patient_id,
                branch_id: dto.branch_id ?? encounter.branch_id ?? null,
                change_summary: summarizeCreate({
                    cancer_type_id: dto.cancer_type_id,
                    cancer_subtype_id: dto.cancer_subtype_id,
                    additional_cancers: additionalCancers,
                    clinical_stage: dto.clinical_stage ?? null,
                    diagnosis_id: dto.diagnosis_id ?? null
                })
            });

            return newId;

        });

        return {
            staging_detail_id: stagingDetailId,
            warnings: validation.warnings,
            data: await this.getStagingDetail(stagingDetailId)
        };

    }

    async updateStagingDetail(stagingDetailId: string, dto: UpdateStagingDetailDto, actingUserId: string) {

        const existing = await this.repository.findStagingDetailById(stagingDetailId);

        if (!existing) {
            throw new Error("Staging detail not found");
        }

        let cancerType = existing.cancer_types;
        let subtype = existing.cancer_subtypes;
        let cascade = {
            icd10_code: existing.icd10_code,
            icd_o3_topo: existing.icd_o3_topo,
            icd_o3_morpho: existing.icd_o3_morpho,
            staging_system: existing.staging_system,
            icdO3Combined: existing.derived_fields?.icd_o3_auto ?? null
        };

        const subtypeChanging = dto.cancer_type_id !== undefined || dto.cancer_subtype_id !== undefined;

        if (subtypeChanging) {

            const targetTypeId = dto.cancer_type_id ?? existing.cancer_type_id;
            const targetSubtypeId = dto.cancer_subtype_id ?? existing.cancer_subtype_id;
            const resolved = await this.resolveCancerTypeAndSubtype(targetTypeId, targetSubtypeId);

            cancerType = resolved.cancerType;
            subtype = resolved.subtype;
            cascade = computeIcdCascade(cancerType, subtype);

        }

        if (dto.diagnosis_id) {

            const diagnosis = await this.repository.findDiagnosisById(dto.diagnosis_id);

            if (!diagnosis) {
                throw new Error("Diagnosis not found");
            }

        }

        if (dto.branch_id) {

            const branch = await this.repository.findBranchById(dto.branch_id);

            if (!branch) {
                throw new Error("Branch not found");
            }

        }

        this.assertLateralityApplies(cancerType.cancer_type, dto.laterality);

        const finalCancerTypeId = dto.cancer_type_id ?? existing.cancer_type_id;

        const additionalCancers = dto.additional_cancers !== undefined && dto.additional_cancers !== null
            ? await this.resolveAdditionalCancers(finalCancerTypeId, dto.additional_cancers)
            : null;

        const staging: StagingInput = {
            cancer_type: cancerType.cancer_type,
            clinical_stage: dto.clinical_stage !== undefined ? dto.clinical_stage : existing.clinical_stage,
            t_stage: dto.t_stage !== undefined ? dto.t_stage : existing.t_stage,
            n_stage: dto.n_stage !== undefined ? dto.n_stage : existing.n_stage,
            m_stage: dto.m_stage !== undefined ? dto.m_stage : existing.m_stage,
            metastasis_sites: dto.metastasis_sites !== undefined
                ? dto.metastasis_sites
                : (existing.metastasis_sites as unknown as string[] | null),
            laterality: dto.laterality !== undefined ? dto.laterality : existing.laterality,
            site: dto.site !== undefined ? dto.site : existing.site,
            grade: dto.grade !== undefined ? dto.grade : existing.grade,
            grade_system: dto.grade_system !== undefined ? dto.grade_system : existing.grade_system,
            pre_diagnosis: dto.pre_diagnosis !== undefined ? dto.pre_diagnosis : existing.pre_diagnosis,
            disease_status: dto.disease_status !== undefined ? dto.disease_status : existing.disease_status
        };

        const ihc: IhcInput = { ...mapIhcRowToInput(existing.ihc_results), ...(dto.ihc ?? {}) };
        const molecular: MolecularInput = { ...mapMolecularRowToInput(existing.molecular_results), ...(dto.molecular ?? {}) };

        const validation = validateOncologyRecord(staging, ihc, molecular);

        if (validation.hardErrors.length > 0) {
            throw new OncologyValidationError(validation.hardErrors);
        }

        const patient = await this.repository.findPatientById(existing.patient_id);
        const patientAgeYears = patient ? computePatientAge(patient) : null;
        const params = await this.repository.loadClinicalParameters();

        const derived = deriveOncologyFields(
            staging,
            ihc,
            molecular,
            { patientAgeYears, icd10FromSubtype: cascade.icd10_code, icdO3FromSubtype: cascade.icdO3Combined },
            params
        );

        const stagingChanges: Prisma.oncology_staging_detailUncheckedUpdateInput = {
            ...(dto.patient_history_id !== undefined && dto.patient_history_id !== null ? { patient_history_id: dto.patient_history_id } : {}),
            ...(dto.diagnosis_id !== undefined && dto.diagnosis_id !== null ? { diagnosis_id: dto.diagnosis_id } : {}),
            ...(dto.visit_date !== undefined ? { visit_date: dto.visit_date ? new Date(dto.visit_date) : null } : {}),
            ...(dto.diagnosis_date !== undefined ? { diagnosis_date: dto.diagnosis_date ? new Date(dto.diagnosis_date) : null } : {}),
            ...(dto.progression_date !== undefined ? { progression_date: dto.progression_date ? new Date(dto.progression_date) : null } : {}),
            ...(dto.relapse_date !== undefined ? { relapse_date: dto.relapse_date ? new Date(dto.relapse_date) : null } : {}),
            ...(dto.second_primary_date !== undefined ? { second_primary_date: dto.second_primary_date ? new Date(dto.second_primary_date) : null } : {}),
            ...(dto.biopsy_date !== undefined ? { biopsy_date: dto.biopsy_date ? new Date(dto.biopsy_date) : null } : {}),
            ...(dto.consulting_oncologist !== undefined && dto.consulting_oncologist !== null ? { consulting_oncologist: dto.consulting_oncologist } : {}),
            ...(subtypeChanging ? {
                cancer_type_id: dto.cancer_type_id ?? existing.cancer_type_id,
                cancer_subtype_id: subtype.subtype_id,
                icd10_code: cascade.icd10_code,
                icd_o3_topo: cascade.icd_o3_topo,
                icd_o3_morpho: cascade.icd_o3_morpho,
                staging_system: cascade.staging_system
            } : {}),
            ...(dto.histopathology !== undefined ? { histopathology: dto.histopathology?.trim() || null } : {}),
            ...(dto.clinical_stage !== undefined && dto.clinical_stage !== null ? { clinical_stage: dto.clinical_stage } : {}),
            ...(dto.t_stage !== undefined && dto.t_stage !== null ? { t_stage: dto.t_stage } : {}),
            ...(dto.n_stage !== undefined && dto.n_stage !== null ? { n_stage: dto.n_stage } : {}),
            ...(dto.m_stage !== undefined && dto.m_stage !== null ? { m_stage: dto.m_stage } : {}),
            ...(dto.metastasis_sites !== undefined ? { metastasis_sites: jsonOrUndefined(dto.metastasis_sites) } : {}),
            ...(dto.laterality !== undefined && dto.laterality !== null ? { laterality: dto.laterality } : {}),
            ...(dto.pre_diagnosis !== undefined && dto.pre_diagnosis !== null ? { pre_diagnosis: dto.pre_diagnosis } : {}),
            ...(dto.disease_status !== undefined && dto.disease_status !== null ? { disease_status: dto.disease_status } : {}),
            ...(dto.site !== undefined && dto.site !== null ? { site: dto.site } : {}),
            ...(dto.grade !== undefined && dto.grade !== null ? { grade: dto.grade } : {}),
            ...(dto.grade_system !== undefined && dto.grade_system !== null ? { grade_system: dto.grade_system } : {}),
            ...(dto.score !== undefined ? { score: dto.score || null } : {}),
            ...(dto.score_system !== undefined ? { score_system: dto.score_system || null } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
            ...(dto.performance_status !== undefined && dto.performance_status !== null ? { performance_status: dto.performance_status } : {}),
            ...(dto.employee_id !== undefined && dto.employee_id !== null ? { employee_id: dto.employee_id } : {}),
            ...(dto.branch_id !== undefined && dto.branch_id !== null ? { branch_id: dto.branch_id } : {})
        };

        await prisma.$transaction(async (tx) => {

            await this.repository.updateStagingDetail(tx, stagingDetailId, stagingChanges);

            if (additionalCancers) {
                await this.repository.replaceAdditionalCancers(tx, stagingDetailId, additionalCancers);
            } else if (finalCancerTypeId !== existing.cancer_type_id) {
                // The new primary type can't also stay listed as an additional one.
                await this.repository.removeAdditionalCancerType(tx, stagingDetailId, finalCancerTypeId);
            }

            if (dto.ihc) {
                await this.repository.upsertIhcResults(tx, stagingDetailId, dto.ihc);
            }

            if (dto.molecular) {
                await this.repository.upsertMolecularResults(tx, stagingDetailId, dto.molecular);
            }

            await this.repository.upsertDerivedFields(tx, stagingDetailId, derivedPersistPayload(derived));

            const auditChanges = {
                ...stagingChanges,
                ...(additionalCancers ? { additional_cancers: additionalCancers } : {}),
                ...(dto.ihc ?? {}),
                ...(dto.molecular ?? {})
            };

            if (Object.keys(auditChanges).length > 0) {

                await logAudit(tx, {
                    entity_type: "oncology_staging_detail",
                    entity_id: stagingDetailId,
                    action: AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: existing.patient_id,
                    branch_id: (dto.branch_id ?? existing.branch_id) ?? null,
                    change_summary: diffFields({
                        ...existing,
                        additional_cancers: existing.oncology_staging_additional_cancers.map((cancer) => ({
                            cancer_type_id: cancer.cancer_type_id,
                            cancer_subtype_id: cancer.cancer_subtype_id,
                            laterality: cancer.laterality,
                            t_stage: cancer.t_stage,
                            n_stage: cancer.n_stage,
                            m_stage: cancer.m_stage
                        })),
                        ...mapIhcRowToInput(existing.ihc_results),
                        ...mapMolecularRowToInput(existing.molecular_results)
                    }, auditChanges)
                });

            }

        });

        return {
            staging_detail_id: stagingDetailId,
            warnings: validation.warnings,
            data: await this.getStagingDetail(stagingDetailId)
        };

    }

    private async upsertBiomarkerSubResource(
        stagingDetailId: string,
        kind: "ihc" | "molecular",
        dto: IhcUpsertDto | MolecularUpsertDto,
        actingUserId: string
    ) {

        const existing = await this.repository.findStagingDetailById(stagingDetailId);

        if (!existing) {
            throw new Error("Staging detail not found");
        }

        const staging: StagingInput = {
            cancer_type: existing.cancer_types.cancer_type,
            clinical_stage: existing.clinical_stage,
            t_stage: existing.t_stage,
            n_stage: existing.n_stage,
            m_stage: existing.m_stage,
            metastasis_sites: existing.metastasis_sites as unknown as string[] | null
        };

        const ihc: IhcInput = kind === "ihc"
            ? { ...mapIhcRowToInput(existing.ihc_results), ...(dto as IhcUpsertDto) }
            : mapIhcRowToInput(existing.ihc_results);

        const molecular: MolecularInput = kind === "molecular"
            ? { ...mapMolecularRowToInput(existing.molecular_results), ...(dto as MolecularUpsertDto) }
            : mapMolecularRowToInput(existing.molecular_results);

        const validation = validateOncologyRecord(staging, ihc, molecular);

        if (validation.hardErrors.length > 0) {
            throw new OncologyValidationError(validation.hardErrors);
        }

        const patient = await this.repository.findPatientById(existing.patient_id);
        const patientAgeYears = patient ? computePatientAge(patient) : null;
        const params = await this.repository.loadClinicalParameters();

        const icdO3Combined = existing.icd_o3_topo && existing.icd_o3_morpho
            ? `${existing.icd_o3_topo} + ${existing.icd_o3_morpho}`
            : (existing.icd_o3_topo ?? existing.icd_o3_morpho ?? null);

        const derived = deriveOncologyFields(
            staging,
            ihc,
            molecular,
            { patientAgeYears, icd10FromSubtype: existing.icd10_code, icdO3FromSubtype: icdO3Combined },
            params
        );

        const existingSubResource = kind === "ihc" ? existing.ihc_results : existing.molecular_results;
        const wasCreate = !existingSubResource;

        await prisma.$transaction(async (tx) => {

            if (kind === "ihc") {
                await this.repository.upsertIhcResults(tx, stagingDetailId, dto as IhcUpsertDto);
            } else {
                await this.repository.upsertMolecularResults(tx, stagingDetailId, dto as MolecularUpsertDto);
            }

            await this.repository.upsertDerivedFields(tx, stagingDetailId, derivedPersistPayload(derived));

            await logAudit(tx, {
                entity_type: kind === "ihc" ? "ihc_results" : "molecular_results",
                entity_id: stagingDetailId,
                action: wasCreate ? AUDIT_ACTION.CREATE : AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                patient_id: existing.patient_id,
                branch_id: existing.branch_id,
                change_summary: wasCreate
                    ? summarizeCreate(dto)
                    : diffFields(kind === "ihc" ? mapIhcRowToInput(existingSubResource) : mapMolecularRowToInput(existingSubResource), dto)
            });

        });

        return {
            staging_detail_id: stagingDetailId,
            warnings: validation.warnings,
            data: await this.getStagingDetail(stagingDetailId)
        };

    }

    async upsertIhc(stagingDetailId: string, dto: IhcUpsertDto, actingUserId: string) {

        return this.upsertBiomarkerSubResource(stagingDetailId, "ihc", dto, actingUserId);

    }

    async upsertMolecular(stagingDetailId: string, dto: MolecularUpsertDto, actingUserId: string) {

        return this.upsertBiomarkerSubResource(stagingDetailId, "molecular", dto, actingUserId);

    }

    // ---------------------------------------------------------------
    // Reads. her2_positive is recomputed live on every read rather than
    // stored (derived_fields has no column for it - see derivedPersistPayload)
    // so it can never go stale relative to the current clinical_parameter
    // thresholds.
    // ---------------------------------------------------------------

    async getStagingDetail(stagingDetailId: string) {

        const row = await this.repository.findStagingDetailById(stagingDetailId);

        if (!row) {
            throw new Error("Staging detail not found");
        }

        const params = await this.repository.loadClinicalParameters();

        return this.attachHer2Positive(row, params);

    }

    async listStagingDetails(filters: StagingDetailFilterQuery) {

        if (filters.view === "ids") {
            return this.repository.listStagingDetailIds(filters);
        }

        const { rows, total, page, limit } = await this.repository.listStagingDetails(filters);
        const params = await this.repository.loadClinicalParameters();

        return {
            rows: rows.map((row) => this.attachHer2Positive(row, params)),
            total,
            page,
            limit
        };

    }

    async getDerivedFields(stagingDetailId: string) {

        const staging = await this.repository.findStagingDetailById(stagingDetailId);

        if (!staging) {
            throw new Error("Staging detail not found");
        }

        if (!staging.derived_fields) {
            throw new Error("Derived fields have not been computed for this staging detail yet");
        }

        const params = await this.repository.loadClinicalParameters();
        const her2Positive = deriveHer2Positive(mapIhcRowToInput(staging.ihc_results), params);

        return { ...staging.derived_fields, her2_positive: her2Positive };

    }

    private attachHer2Positive(row: any, params: ClinicalParameters) {

        const her2Positive = row.ihc_results
            ? deriveHer2Positive(mapIhcRowToInput(row.ihc_results), params)
            : null;

        return { ...row, her2_positive: her2Positive };

    }

}
