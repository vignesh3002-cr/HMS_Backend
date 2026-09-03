import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { OncologyRepository } from "./oncology.repository";
import { validateOncologyRecord } from "./chemo.validation";
import { deriveOncologyFields, deriveHer2Positive } from "./chemo.derivation";
import { ENCOUNTER_OPEN_STATUS, ENCOUNTER_RECENCY_WINDOW_DAYS } from "./oncology.constants";
import { logAudit, diffFields, summarizeCreate } from "../audit/audit.service";
import { AUDIT_ACTION } from "../audit/audit.types";
import {
    StagingInput,
    IhcInput,
    MolecularInput,
    RuleViolation,
    ClinicalParameters,
    DerivedOncologyFields,
    CreateStagingDetailDto,
    UpdateStagingDetailDto,
    IhcUpsertDto,
    MolecularUpsertDto,
    StagingDetailFilterQuery
} from "./oncology.types";

export class OncologyValidationError extends Error {

    violations: RuleViolation[];

    constructor(violations: RuleViolation[]) {

        super("Oncology validation failed");
        this.name = "OncologyValidationError";
        this.violations = violations;

    }

}

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

        return this.repository.findCancerTypes();

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

        return this.repository.findStagingReferenceByType(cancerTypeId);

    }

    async listBiomarkerTests() {

        return this.repository.findBiomarkerTests();

    }

    async listMolecularSubtypes() {

        return this.repository.findMolecularSubtypes();

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

        const { cancerType, subtype } = await this.resolveCancerTypeAndSubtype(dto.cancer_type_id, dto.cancer_subtype_id);

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
            metastasis_sites: dto.metastasis_sites ?? null
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
                visit_date: dto.visit_date ? new Date(dto.visit_date) : null,
                diagnosis_date: dto.diagnosis_date ? new Date(dto.diagnosis_date) : null,
                biopsy_date: dto.biopsy_date ? new Date(dto.biopsy_date) : null,
                consulting_oncologist: dto.consulting_oncologist ?? null,
                cancer_type_id: dto.cancer_type_id,
                cancer_subtype_id: dto.cancer_subtype_id,
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
                performance_status: dto.performance_status ?? null,
                // Default to whoever actually saw the patient in the
                // qualifying encounter, unless the caller explicitly names
                // a different consulting oncologist/branch.
                employee_id: dto.employee_id ?? encounter.employee_id ?? null,
                branch_id: dto.branch_id ?? encounter.branch_id ?? null,
                user_id: actingUserId
            });

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

        const staging: StagingInput = {
            cancer_type: cancerType.cancer_type,
            clinical_stage: dto.clinical_stage !== undefined ? dto.clinical_stage : existing.clinical_stage,
            t_stage: dto.t_stage !== undefined ? dto.t_stage : existing.t_stage,
            n_stage: dto.n_stage !== undefined ? dto.n_stage : existing.n_stage,
            m_stage: dto.m_stage !== undefined ? dto.m_stage : existing.m_stage,
            metastasis_sites: dto.metastasis_sites !== undefined
                ? dto.metastasis_sites
                : (existing.metastasis_sites as unknown as string[] | null)
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
            ...(dto.clinical_stage !== undefined && dto.clinical_stage !== null ? { clinical_stage: dto.clinical_stage } : {}),
            ...(dto.t_stage !== undefined && dto.t_stage !== null ? { t_stage: dto.t_stage } : {}),
            ...(dto.n_stage !== undefined && dto.n_stage !== null ? { n_stage: dto.n_stage } : {}),
            ...(dto.m_stage !== undefined && dto.m_stage !== null ? { m_stage: dto.m_stage } : {}),
            ...(dto.metastasis_sites !== undefined ? { metastasis_sites: jsonOrUndefined(dto.metastasis_sites) } : {}),
            ...(dto.laterality !== undefined && dto.laterality !== null ? { laterality: dto.laterality } : {}),
            ...(dto.performance_status !== undefined && dto.performance_status !== null ? { performance_status: dto.performance_status } : {}),
            ...(dto.employee_id !== undefined && dto.employee_id !== null ? { employee_id: dto.employee_id } : {}),
            ...(dto.branch_id !== undefined && dto.branch_id !== null ? { branch_id: dto.branch_id } : {})
        };

        await prisma.$transaction(async (tx) => {

            await this.repository.updateStagingDetail(tx, stagingDetailId, stagingChanges);

            if (dto.ihc) {
                await this.repository.upsertIhcResults(tx, stagingDetailId, dto.ihc);
            }

            if (dto.molecular) {
                await this.repository.upsertMolecularResults(tx, stagingDetailId, dto.molecular);
            }

            await this.repository.upsertDerivedFields(tx, stagingDetailId, derivedPersistPayload(derived));

            const auditChanges = { ...stagingChanges, ...(dto.ihc ?? {}), ...(dto.molecular ?? {}) };

            if (Object.keys(auditChanges).length > 0) {

                await logAudit(tx, {
                    entity_type: "oncology_staging_detail",
                    entity_id: stagingDetailId,
                    action: AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: existing.patient_id,
                    branch_id: (dto.branch_id ?? existing.branch_id) ?? null,
                    change_summary: diffFields({ ...existing, ...mapIhcRowToInput(existing.ihc_results), ...mapMolecularRowToInput(existing.molecular_results) }, auditChanges)
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
