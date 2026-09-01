import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";
import { ChemotherapyRepository } from "./chemotherapy.repository";
import { OncologyRepository } from "../oncology/oncology.repository";
import {
    PLAN_STATUS,
    PLAN_STATUS_TRANSITIONS,
    PLAN_TERMINAL_STATUSES,
    PlanStatus,
    CYCLE_STATUS,
    CYCLE_STATUS_TRANSITIONS,
    CYCLE_TERMINAL_STATUSES,
    CYCLE_ADMINISTRABLE_STATUSES,
    CycleStatus,
    PROTOCOL_TYPE,
    PROTOCOL_ACTIVE_STATUS,
    DRUG_ROLE
} from "./chemotherapy.constants";
import {
    CreatePlanDto,
    UpdatePlanDto,
    PlanStatusChangeDto,
    PlanFilterQuery,
    AddPlanItemDto,
    PlanItemInputDto,
    CreateCycleDto,
    UpdateCycleDto,
    CycleStatusChangeDto,
    RecordAdministrationDto,
    RecordVitalsDto,
    RecordAdverseEventDto,
    RecordLabReviewDto,
    RecordFollowupDto,
    CreateRegimenProtocolDto,
    UpdateRegimenProtocolDto,
    RegimenProtocolFilterQuery,
    PersonalizeRegimenProtocolDto,
    UpdatePersonalizedProtocolDto,
    PersonalizationDayInput,
    PersonalizationItemInput,
    PersonalizationDilutionInput,
    AddPersonalizedProtocolItemDto,
    UpdatePersonalizedProtocolItemDto,
    AddPersonalizedProtocolDayDto,
    UpdatePersonalizedProtocolDayDto,
    AddPersonalizedProtocolDilutionDto,
    UpdatePersonalizedProtocolDilutionDto,
    VersionPersonalizedProtocolDto
} from "./chemotherapy.types";
import { logAudit, diffFields, summarizeCreate, summarizeStatusChange } from "../audit/audit.service";
import { AUDIT_ACTION } from "../audit/audit.types";

function isPlanStatus(value: string): value is PlanStatus {
    return Object.values(PLAN_STATUS).includes(value as PlanStatus);
}

function isCycleStatus(value: string): value is CycleStatus {
    return Object.values(CYCLE_STATUS).includes(value as CycleStatus);
}

function appendNote(existing: string | null | undefined, note: string | null | undefined): string | null {

    if (!note) {
        return existing ?? null;
    }

    return existing ? `${existing}\n${note}` : note;

}

export class ChemotherapyService {

    private repository = new ChemotherapyRepository();
    private oncologyRepository = new OncologyRepository();

    // ---------------------------------------------------------------
    // Plan preview - lets a doctor see the computed suggested_therapy
    // (which may legitimately be null outside Breast/Lung) before they
    // decide whether to confirm it and create the plan.
    // ---------------------------------------------------------------

    async previewPlan(stagingDetailId: string, organizationId?: string | null) {

        const staging = await this.repository_findStagingDetailOrThrow(stagingDetailId);

        // Surfaced alongside the advisory suggested_therapy text so the
        // doctor can pick a matching protocol to pre-fill the create-plan
        // form with - matching_protocols is just a menu, nothing here is
        // applied automatically. Generic protocols are always listed;
        // the caller's organization's active personalized protocols are
        // included when the org context is available.
        const matchingProtocols = await this.repository.listRegimenProtocols({
            cancer_type_id: staging.cancer_type_id,
            subtype_id: staging.cancer_subtype_id,
            ...(organizationId ? { organization_id: organizationId } : {})
        });

        return {
            staging_detail_id: staging.staging_detail_id,
            patient_id: staging.patient_id,
            cancer_type: staging.cancer_types.cancer_type,
            cancer_subtype: staging.cancer_subtypes.subtype_name,
            clinical_stage: staging.clinical_stage,
            suggested_therapy: staging.derived_fields?.suggested_therapy ?? null,
            breast_mol_subtype: staging.derived_fields?.breast_mol_subtype ?? null,
            germline_referral_flag: staging.derived_fields?.germline_referral_flag ?? false,
            matching_protocols: matchingProtocols
        };

    }

    // ---------------------------------------------------------------
    // Regimen protocol templates (reference data - browsing does not
    // require a staging detail; previewPlan above is the shortcut for the
    // "already picked a diagnosis" path).
    // ---------------------------------------------------------------

    async listRegimenProtocols(filters: RegimenProtocolFilterQuery) {

        return this.repository.listRegimenProtocols(filters);

    }

    async getRegimenProtocol(protocolId: string, organizationId?: string | null) {

        const protocol = await this.repository.findRegimenProtocolById(protocolId);

        if (!protocol) {
            throw new Error("Regimen protocol not found");
        }

        // Organization isolation: a personalized protocol may only be read
        // by a member of its owning organization (server-side - the org
        // always comes from the authenticated user context, never from
        // request input).
        if (protocol.protocol_type === PROTOCOL_TYPE.PERSONALIZED) {

            if (!organizationId || protocol.organization_id !== organizationId) {
                throw new Error("You do not have access to this protocol");
            }

        }

        return protocol;

    }

    async getDischargeMedicinesForProtocol(protocolId: string, organizationId?: string | null) {

        // Reuse the protocol read path so existence + personalized-protocol
        // org isolation are enforced before returning its discharge medicines.
        await this.getRegimenProtocol(protocolId, organizationId);

        return this.repository.listDischargeMedicinesForProtocol(protocolId);

    }

    async createRegimenProtocol(dto: CreateRegimenProtocolDto, actingUserId: string) {

        const cancerType = await this.repository.findCancerTypeById(dto.cancer_type_id);

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        if (dto.subtype_id) {

            const subtype = await this.repository.findCancerSubtypeById(dto.subtype_id);

            if (!subtype) {
                throw new Error("Cancer subtype not found");
            }

            if (subtype.cancer_type_id !== dto.cancer_type_id) {
                throw new Error("Selected subtype does not belong to the selected cancer type");
            }

        }

        const existing = await this.repository.findRegimenProtocolByCode(dto.cancer_type_id, dto.subtype_id ?? null, dto.regimen_code);

        if (existing) {
            throw new Error(`A protocol with code ${dto.regimen_code} already exists for this cancer type/subtype`);
        }

        if (!dto.items || dto.items.length === 0) {
            throw new Error("At least one protocol item (drug) is required");
        }

        for (const item of dto.items) {

            const medicine = await this.repository.findMedicineById(item.medicine_id);

            if (!medicine) {
                throw new Error(`Medicine not found: ${item.medicine_id}`);
            }

        }

        const protocolId = await prisma.$transaction(async (tx) => {

            const newProtocolId = await this.repository.generateRegimenProtocolId(tx);

            await this.repository.createRegimenProtocol(tx, {
                protocol_id: newProtocolId,
                regimen_code: dto.regimen_code,
                regimen_name: dto.regimen_name,
                protocol_version: dto.protocol_version ?? null,
                // Protocols created through the standard template API are
                // always globally shared reference templates. Personalized
                // organization-owned copies are created exclusively through
                // the personalize flow below.
                protocol_type: PROTOCOL_TYPE.GENERIC,
                organization_id: null,
                cancer_type_id: dto.cancer_type_id,
                subtype_id: dto.subtype_id ?? null,
                treatment_intent: dto.treatment_intent ?? null,
                standard_cycles: dto.standard_cycles ?? null,
                cycle_interval_days: dto.cycle_interval_days ?? null,
                guideline_source: dto.guideline_source ?? null,
                notes: dto.notes ?? null
            });

            for (const item of dto.items) {

                const itemId = await this.repository.generateRegimenProtocolItemId(tx);

                await this.repository.createRegimenProtocolItem(tx, {
                    protocol_item_id: itemId,
                    protocol_id: newProtocolId,
                    medicine_id: item.medicine_id,
                    drug_role: item.drug_role ?? "PRIMARY",
                    drug_sequence: item.drug_sequence,
                    drug_type: item.drug_type ?? null,
                    dosage: item.dosage ?? null,
                    dosage_unit: item.dosage_unit ?? null,
                    dose_calculation_method: item.dose_calculation_method ?? null,
                    administration_route: item.administration_route ?? null,
                    infusion_type: item.infusion_type ?? null,
                    infusion_duration_minutes: item.infusion_duration_minutes ?? null,
                    administration_day: item.administration_day ?? null,
                    cycle_day: item.cycle_day ?? null,
                    frequency: item.frequency ?? null,
                    timing_relative_to_primary: item.timing_relative_to_primary ?? null,
                    remarks: item.remarks ?? null
                });

            }

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol",
                entity_id: newProtocolId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ regimen_code: dto.regimen_code, cancer_type_id: dto.cancer_type_id, subtype_id: dto.subtype_id ?? null, item_count: dto.items.length })
            });

            return newProtocolId;

        }, { timeout: 20000 });

        return this.getRegimenProtocol(protocolId);

    }

    async updateRegimenProtocol(protocolId: string, dto: UpdateRegimenProtocolDto, actingUserId: string) {

        const existing = await this.repository.findRegimenProtocolById(protocolId);

        if (!existing) {
            throw new Error("Regimen protocol not found");
        }

        if (existing.protocol_type === PROTOCOL_TYPE.PERSONALIZED) {
            throw new Error("Personalized protocols must be edited through the personalized protocol endpoints");
        }

        const protocolChanges = {
            ...(dto.regimen_name !== undefined ? { regimen_name: dto.regimen_name } : {}),
            ...(dto.protocol_version !== undefined ? { protocol_version: dto.protocol_version } : {}),
            ...(dto.treatment_intent !== undefined ? { treatment_intent: dto.treatment_intent } : {}),
            ...(dto.standard_cycles !== undefined ? { standard_cycles: dto.standard_cycles } : {}),
            ...(dto.cycle_interval_days !== undefined ? { cycle_interval_days: dto.cycle_interval_days } : {}),
            ...(dto.guideline_source !== undefined ? { guideline_source: dto.guideline_source } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {})
        };

        await prisma.$transaction(async (tx) => {

            await this.repository.updateRegimenProtocol(tx, protocolId, protocolChanges);

            if (Object.keys(protocolChanges).length > 0) {

                await logAudit(tx, {
                    entity_type: "chemotherapy_regimen_protocol",
                    entity_id: protocolId,
                    action: AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    change_summary: diffFields(existing, protocolChanges)
                });

            }

        });

        return this.getRegimenProtocol(protocolId);

    }

    async addRegimenProtocolItem(protocolId: string, item: CreateRegimenProtocolDto["items"][number], actingUserId: string) {

        const existing = await this.repository.findRegimenProtocolById(protocolId);

        if (!existing) {
            throw new Error("Regimen protocol not found");
        }

        if (existing.protocol_type === PROTOCOL_TYPE.PERSONALIZED) {
            throw new Error("Personalized protocols must be edited through the personalized protocol endpoints");
        }

        const medicine = await this.repository.findMedicineById(item.medicine_id);

        if (!medicine) {
            throw new Error("Medicine not found");
        }

        await prisma.$transaction(async (tx) => {

            const itemId = await this.repository.generateRegimenProtocolItemId(tx);

            await this.repository.createRegimenProtocolItem(tx, {
                protocol_item_id: itemId,
                protocol_id: protocolId,
                medicine_id: item.medicine_id,
                drug_role: item.drug_role ?? "PRIMARY",
                drug_sequence: item.drug_sequence,
                drug_type: item.drug_type ?? null,
                dosage: item.dosage ?? null,
                dosage_unit: item.dosage_unit ?? null,
                dose_calculation_method: item.dose_calculation_method ?? null,
                administration_route: item.administration_route ?? null,
                infusion_type: item.infusion_type ?? null,
                infusion_duration_minutes: item.infusion_duration_minutes ?? null,
                administration_day: item.administration_day ?? null,
                cycle_day: item.cycle_day ?? null,
                frequency: item.frequency ?? null,
                timing_relative_to_primary: item.timing_relative_to_primary ?? null,
                remarks: item.remarks ?? null
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol_items",
                entity_id: itemId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ protocol_id: protocolId, medicine_id: item.medicine_id, drug_role: item.drug_role ?? "PRIMARY" })
            });

        });

        return this.getRegimenProtocol(protocolId);

    }

    async removeRegimenProtocolItem(protocolId: string, protocolItemId: string, actingUserId: string) {

        const existing = await this.repository.findRegimenProtocolById(protocolId);

        if (!existing) {
            throw new Error("Regimen protocol not found");
        }

        if (existing.protocol_type === PROTOCOL_TYPE.PERSONALIZED) {
            throw new Error("Personalized protocols must be edited through the personalized protocol endpoints");
        }

        const item = await this.repository.findRegimenProtocolItemById(protocolItemId);

        if (!item || item.protocol_id !== protocolId) {
            throw new Error("Protocol item not found on this protocol");
        }

        await prisma.$transaction(async (tx) => {

            await this.repository.deactivateRegimenProtocolItem(tx, protocolItemId);

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol_items",
                entity_id: protocolItemId,
                action: AUDIT_ACTION.DEACTIVATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ protocol_id: protocolId, medicine_id: item.medicine_id })
            });

        });

        return this.getRegimenProtocol(protocolId);

    }

    // ---------------------------------------------------------------
    // Organization-specific personalized regimen protocols
    //
    // Lifecycle: GENERIC -> SELECT -> CLONE -> ORGANIZATION OWNERSHIP ->
    // CUSTOMIZE -> VALIDATE -> DRAFT -> ACTIVATE -> USE IN PLAN ->
    // NEW VERSION when clinically used.
    //
    // A personalized protocol is a full independent copy of a generic
    // protocol (protocol -> days -> items -> dilutions) created inside a
    // single transaction with brand-new IDs. The generic source is never
    // written to. Editing is only allowed while the copy has not been used
    // by a chemotherapy plan; once used, the only safe path is to create a
    // new version (protocol_reference -> previous version, original_protocol
    // -> root generic, protocol_version incremented).
    // ---------------------------------------------------------------

    private assertPersonalizedOwner<T>(protocol: T, organizationId: string | null | undefined): asserts protocol is Exclude<T, null | undefined> {

        if (!protocol) {
            throw new Error("Personalized protocol not found");
        }

        const p = protocol as any;

        if (p.protocol_type !== PROTOCOL_TYPE.PERSONALIZED) {
            throw new Error("This operation is only valid for personalized protocols");
        }

        if (!organizationId || p.organization_id !== organizationId) {
            throw new Error("You do not have access to this protocol");
        }

    }

    private async assertNotClinicallyUsed(protocolId: string) {

        const usage = await this.repository.countPlansUsingProtocol(protocolId);

        if (usage > 0) {
            throw new Error("This protocol has already been referenced by a chemotherapy treatment plan; create a new version instead of modifying it");
        }

    }

    private async validatePersonalizedStructure(
        dto: PersonalizeRegimenProtocolDto,
        days: PersonalizationDayInput[],
        items: PersonalizationItemInput[]
    ) {

        if (dto.standard_cycles !== undefined && dto.standard_cycles !== null && dto.standard_cycles < 1) {
            throw new Error("standard_cycles must be at least 1");
        }

        if (dto.cycle_interval_days !== undefined && dto.cycle_interval_days !== null && dto.cycle_interval_days < 1) {
            throw new Error("cycle_interval_days must be at least 1");
        }

        const dayNumbers = days.map((d) => d.day_number);

        if (new Set(dayNumbers).size !== dayNumbers.length) {
            throw new Error("Duplicate day_number values are not allowed");
        }

        for (const day of days) {

            if (!Number.isInteger(day.day_number) || day.day_number < 1) {
                throw new Error("Each protocol day requires a day_number >= 1");
            }

            if (day.day_sequence !== undefined && day.day_sequence !== null && (!Number.isInteger(day.day_sequence) || day.day_sequence < 0)) {
                throw new Error("day_sequence must be >= 0");
            }

        }

        if (!items || items.length === 0) {
            throw new Error("At least one protocol item (drug) is required");
        }

        for (const item of items) {

            if (!item.medicine_id) {
                throw new Error("Each protocol item requires a medicine_id");
            }

            const medicine = await this.repository.findActiveMedicineById(item.medicine_id);

            if (!medicine) {
                throw new Error(`Medicine not found or inactive: ${item.medicine_id}`);
            }

            if (!Number.isInteger(item.drug_sequence) || item.drug_sequence < 1) {
                throw new Error("Each protocol item requires a drug_sequence >= 1");
            }

            if (item.drug_role && !Object.values(DRUG_ROLE).includes(item.drug_role)) {
                throw new Error(`drug_role must be one of: ${Object.values(DRUG_ROLE).join(", ")}`);
            }

            for (const dilution of item.dilutions ?? []) {

                if (dilution.medicine_id) {

                    const dilutionMedicine = await this.repository.findActiveMedicineById(dilution.medicine_id);

                    if (!dilutionMedicine) {
                        throw new Error(`Medicine not found or inactive for dilution: ${dilution.medicine_id}`);
                    }

                }

            }

        }

    }

    private async resolveUniqueRegimenCode(tx: Prisma.TransactionClient, sourceRegimenCode: string, organizationId: string, newProtocolId: string) {

        // regimen_code is globally unique (uq_regimen_protocol_code), so the
        // personalized copy gets a derived code based on the source code,
        // the owning organization and its fresh protocol_id. Using the new
        // protocol_id guarantees uniqueness without any extra lookup.
        const base = `${sourceRegimenCode}-${organizationId}-${newProtocolId}`;

        let code = base;
        let suffix = 1;

        while (await tx.chemotherapy_regimen_protocol.findUnique({ where: { regimen_code: code } })) {
            suffix++;
            code = `${base}-${suffix}`;
        }

        return code;

    }

    private incrementVersion(currentVersion: string | null | undefined): string {

        const match = /(\d+)(?!.*\d)/.exec(currentVersion ?? "v0");

        const next = match ? Number(match[1]) + 1 : 1;

        return `v${next}`;

    }

    private async applyStructure(
        tx: Prisma.TransactionClient,
        protocolId: string,
        structure: { days: PersonalizationDayInput[]; items: PersonalizationItemInput[] },
        existingDays: { protocol_day_id: string; source_day_resource_id: string | null; day_number: number }[],
        existingItems: {
            protocol_item_id: string;
            source_resource_id: string | null;
            medicine_id: string;
            drug_sequence: number;
            chemotherapy_protocol_dilutions: { protocol_dilution_id: string; source_resource_id: string | null; medicine_id: string | null; form: string | null }[];
        }[],
        actingUserId: string
    ) {

        // ---------- Protocol days ----------

        const keptDayIds: string[] = [];

        for (const day of structure.days) {

            const match = existingDays.find((ed) =>
                day.protocol_day_id ? ed.protocol_day_id === day.protocol_day_id
                : day.source_day_resource_id ? ed.source_day_resource_id === day.source_day_resource_id
                : ed.day_number === day.day_number
            );

            const payload = {
                day_number: day.day_number,
                day_sequence: day.day_sequence ?? null,
                same_as_day_one: day.same_as_day_one ?? false,
                active_status: day.active_status ?? PROTOCOL_ACTIVE_STATUS.ACTIVE,
                updated_by: actingUserId
            };

            if (match) {

                keptDayIds.push(match.protocol_day_id);
                await this.repository.updateRegimenProtocolDay(tx, match.protocol_day_id, payload);

            } else {

                const newDayId = await this.repository.generateRegimenProtocolDayId(tx);

                await this.repository.createRegimenProtocolDay(tx, {
                    protocol_day_id: newDayId,
                    protocol_id: protocolId,
                    source_day_resource_id: day.source_day_resource_id ?? null,
                    created_by: actingUserId,
                    ...payload
                });

            }

        }

        for (const existingDay of existingDays) {

            if (!keptDayIds.includes(existingDay.protocol_day_id)) {
                await this.repository.deactivateRegimenProtocolDay(tx, existingDay.protocol_day_id);
            }

        }

        // ---------- Protocol items (with dilutions) ----------

        const keptItemIds: string[] = [];

        for (const item of structure.items) {

            const match = existingItems.find((ei) =>
                item.protocol_item_id ? ei.protocol_item_id === item.protocol_item_id
                : item.source_resource_id ? ei.source_resource_id === item.source_resource_id
                : (ei.medicine_id === item.medicine_id && ei.drug_sequence === item.drug_sequence)
            );

            const payload = {
                medicine_id: item.medicine_id,
                drug_role: item.drug_role ?? "PRIMARY",
                drug_sequence: item.drug_sequence,
                drug_type: item.drug_type ?? null,
                dosage: item.dosage ?? null,
                dosage_unit: item.dosage_unit ?? null,
                dose_calculation_method: item.dose_calculation_method ?? null,
                administration_route: item.administration_route ?? null,
                infusion_type: item.infusion_type ?? null,
                infusion_duration_minutes: item.infusion_duration_minutes ?? null,
                administration_day: item.administration_day ?? null,
                cycle_day: item.cycle_day ?? null,
                frequency: item.frequency ?? null,
                timing_relative_to_primary: item.timing_relative_to_primary ?? null,
                remarks: item.remarks ?? null,
                drug_brand_name: item.drug_brand_name ?? null,
                protocol_dose: item.protocol_dose ?? null,
                protocol_dose_unit: item.protocol_dose_unit ?? null,
                protocol_dose_text: item.protocol_dose_text ?? null,
                active_status: item.active_status ?? PROTOCOL_ACTIVE_STATUS.ACTIVE
            };

            let itemId: string;

            if (match) {

                keptItemIds.push(match.protocol_item_id);
                itemId = match.protocol_item_id;
                await this.repository.updateRegimenProtocolItem(tx, match.protocol_item_id, payload);

            } else {

                itemId = await this.repository.generateRegimenProtocolItemId(tx);
                keptItemIds.push(itemId);

                await this.repository.createRegimenProtocolItem(tx, {
                    protocol_item_id: itemId,
                    protocol_id: protocolId,
                    source_resource_id: item.source_resource_id ?? null,
                    ...payload
                });

            }

            const existingItemDilutions = existingItems.find((ei) => ei.protocol_item_id === itemId)?.chemotherapy_protocol_dilutions ?? [];
            const keptDilutionIds: string[] = [];

            for (const dilution of item.dilutions ?? []) {

                const matchDilution = existingItemDilutions.find((ed) =>
                    dilution.protocol_dilution_id ? ed.protocol_dilution_id === dilution.protocol_dilution_id
                    : dilution.source_resource_id ? ed.source_resource_id === dilution.source_resource_id
                    : (ed.medicine_id === dilution.medicine_id && ed.form === dilution.form)
                );

                const dilutionPayload = {
                    protocol_id: protocolId,
                    protocol_item_id: itemId,
                    medicine_id: dilution.medicine_id ?? null,
                    form: dilution.form ?? null,
                    dose: dilution.dose ?? null,
                    dose_unit: dilution.dose_unit ?? null,
                    dilution_volume: dilution.dilution_volume ?? null,
                    dilution_volume_unit: dilution.dilution_volume_unit ?? null,
                    diluent: dilution.diluent ?? null,
                    comment: dilution.comment ?? null,
                    active_status: dilution.active_status ?? PROTOCOL_ACTIVE_STATUS.ACTIVE,
                    updated_by: actingUserId
                };

                if (matchDilution) {

                    keptDilutionIds.push(matchDilution.protocol_dilution_id);
                    await this.repository.updateRegimenProtocolDilution(tx, matchDilution.protocol_dilution_id, dilutionPayload);

                } else {

                    const newDilutionId = await this.repository.generateRegimenProtocolDilutionId(tx);
                    keptDilutionIds.push(newDilutionId);

                    await this.repository.createRegimenProtocolDilution(tx, {
                        protocol_dilution_id: newDilutionId,
                        source_resource_id: dilution.source_resource_id ?? null,
                        created_by: actingUserId,
                        ...dilutionPayload
                    });

                }

            }

            for (const existingDilution of existingItemDilutions) {

                if (!keptDilutionIds.includes(existingDilution.protocol_dilution_id)) {
                    await this.repository.deactivateRegimenProtocolDilution(tx, existingDilution.protocol_dilution_id);
                }

            }

        }

        for (const existingItem of existingItems) {

            if (!keptItemIds.includes(existingItem.protocol_item_id)) {
                await this.repository.deactivateRegimenProtocolItem(tx, existingItem.protocol_item_id);
            }

        }

    }

    private async buildPersonalizedEditorPayload(protocol: NonNullable<Awaited<ReturnType<ChemotherapyRepository["findPersonalizedProtocolById"]>>>, organizationId: string) {

        const organization = await this.repository.findHospitalById(organizationId);

        const rootSource = protocol.original_protocol
            ? await this.repository.findRegimenProtocolById(protocol.original_protocol)
            : null;

        const parent = protocol.protocol_reference
            ? await this.repository.findRegimenProtocolByIdFull(protocol.protocol_reference)
            : null;

        const parentItemsById = new Map((parent?.chemotherapy_regimen_protocol_items ?? []).map((i) => [i.protocol_item_id, i]));

        const COMPARED_FIELDS = [
            "drug_role", "drug_sequence", "drug_type", "dosage", "dosage_unit",
            "dose_calculation_method", "administration_route", "infusion_type",
            "infusion_duration_minutes", "administration_day", "cycle_day", "frequency",
            "timing_relative_to_primary", "remarks", "drug_brand_name", "protocol_dose",
            "protocol_dose_unit", "protocol_dose_text"
        ] as const;

        const items = (protocol.chemotherapy_regimen_protocol_items ?? []).map((item) => {

            const inherited = item.source_resource_id ? parentItemsById.get(item.source_resource_id) : null;

            const currentValues: Record<string, any> = {};

            for (const field of COMPARED_FIELDS) {
                const value = (item as any)[field];
                currentValues[field] = value != null && typeof value === "object" && "toJSON" in value ? Number(value) : value;
            }

            const diff = inherited ? diffFields(inherited, currentValues) : "{}";

            return {
                ...item,
                inherited_from: item.source_resource_id ?? null,
                is_modified: diff !== "{}",
                original_values: inherited
                    ? COMPARED_FIELDS.reduce((acc: Record<string, any>, field) => {
                        const value = (inherited as any)[field];
                        acc[field] = value != null && typeof value === "object" && "toJSON" in value ? Number(value) : value;
                        return acc;
                    }, {})
                    : null,
                dilutions: (item.chemotherapy_protocol_dilutions ?? []).map((dilution) => ({
                    ...dilution,
                    inherited_from: dilution.source_resource_id ?? null
                }))
            };

        });

        const dayNumbers = new Set((protocol.chemotherapy_regimen_protocol_days ?? []).map((d) => d.day_number));

        const days = (protocol.chemotherapy_regimen_protocol_days ?? []).map((day) => ({
            ...day,
            items: items.filter((item) => item.administration_day === day.day_number).sort((a, b) => a.drug_sequence - b.drug_sequence)
        }));

        const unassignedItems = items.filter((item) => item.administration_day == null || !dayNumbers.has(item.administration_day!));

        return {
            protocol: {
                protocol_id: protocol.protocol_id,
                regimen_code: protocol.regimen_code,
                regimen_name: protocol.regimen_name,
                protocol_version: protocol.protocol_version,
                protocol_type: protocol.protocol_type,
                organization_id: protocol.organization_id,
                protocol_reference: protocol.protocol_reference,
                original_protocol: protocol.original_protocol,
                cancer_type_id: protocol.cancer_type_id,
                subtype_id: protocol.subtype_id,
                treatment_intent: protocol.treatment_intent,
                standard_cycles: protocol.standard_cycles,
                cycle_interval_days: protocol.cycle_interval_days,
                guideline_source: protocol.guideline_source,
                notes: protocol.notes,
                composition: protocol.composition,
                additional_notes: protocol.additional_notes,
                no_of_days: protocol.no_of_days,
                day_care_referred: protocol.day_care_referred,
                create_day_care_appointment: protocol.create_day_care_appointment,
                active_status: protocol.active_status,
                created_at: protocol.created_at,
                updated_at: protocol.updated_at
            },
            organization: organization ? { hospital_id: organization.hospital_id, hospital_name: organization.hospital_name } : null,
            source_protocol: rootSource
                ? {
                    protocol_id: rootSource.protocol_id,
                    regimen_code: rootSource.regimen_code,
                    regimen_name: rootSource.regimen_name,
                    protocol_version: rootSource.protocol_version,
                    protocol_type: rootSource.protocol_type,
                    standard_cycles: rootSource.standard_cycles,
                    cycle_interval_days: rootSource.cycle_interval_days,
                    guideline_source: rootSource.guideline_source
                }
                : null,
            version: protocol.protocol_version ?? "v1",
            status: (protocol.active_status ?? 1) === PROTOCOL_ACTIVE_STATUS.ACTIVE ? "ACTIVE" : "DRAFT",
            clinically_used: (await this.repository.countPlansUsingProtocol(protocol.protocol_id)) > 0,
            cancer_type: protocol.cancer_types ?? null,
            cancer_subtype: protocol.cancer_subtypes ?? null,
            days,
            unassigned_items: unassignedItems
        };

    }

    async listPersonalizedProtocols(organizationId: string) {

        if (!organizationId) {
            throw new Error("Your account is not associated with a hospital/organization");
        }

        const protocols = await this.repository.listPersonalizedProtocols(organizationId);

        return Promise.all(protocols.map((protocol) => this.buildPersonalizedEditorPayload(protocol, organizationId)));

    }

    async getPersonalizedProtocol(protocolId: string, organizationId: string) {

        if (!organizationId) {
            throw new Error("Your account is not associated with a hospital/organization");
        }

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        return this.buildPersonalizedEditorPayload(protocol, organizationId);

    }

    async personalizeProtocol(sourceProtocolId: string, organizationId: string, actingUserId: string, dto: PersonalizeRegimenProtocolDto) {

        if (!organizationId) {
            throw new Error("Your account is not associated with a hospital/organization");
        }

        const organization = await this.repository.findHospitalById(organizationId);

        if (!organization) {
            throw new Error("Organization (hospital) not found");
        }

        const source = await this.repository.findRegimenProtocolByIdFull(sourceProtocolId);

        if (!source) {
            throw new Error("Regimen protocol not found");
        }

        if (source.protocol_type === PROTOCOL_TYPE.PERSONALIZED) {
            throw new Error("Only generic protocols can be personalized");
        }

        if ((source.active_status ?? 1) !== PROTOCOL_ACTIVE_STATUS.ACTIVE) {
            throw new Error("Only an active generic protocol can be personalized");
        }

        // Clone source structure unless the caller supplies an explicit
        // customization payload - the clone is the default starting point.
        const days: PersonalizationDayInput[] = dto.days ?? (source.chemotherapy_regimen_protocol_days ?? []).map((day) => ({
            day_number: day.day_number,
            day_sequence: day.day_sequence,
            same_as_day_one: day.same_as_day_one,
            source_day_resource_id: day.source_day_resource_id ?? day.protocol_day_id
        }));

        const items: PersonalizationItemInput[] = dto.items ?? (source.chemotherapy_regimen_protocol_items ?? []).map((item) => ({
            medicine_id: item.medicine_id,
            drug_role: item.drug_role as PersonalizationItemInput["drug_role"],
            drug_sequence: item.drug_sequence,
            drug_type: item.drug_type,
            dosage: item.dosage != null ? Number(item.dosage) : null,
            dosage_unit: item.dosage_unit,
            dose_calculation_method: item.dose_calculation_method,
            administration_route: item.administration_route,
            infusion_type: item.infusion_type,
            infusion_duration_minutes: item.infusion_duration_minutes,
            administration_day: item.administration_day,
            cycle_day: item.cycle_day,
            frequency: item.frequency,
            timing_relative_to_primary: item.timing_relative_to_primary,
            remarks: item.remarks,
            drug_brand_name: item.drug_brand_name,
            protocol_dose: item.protocol_dose != null ? Number(item.protocol_dose) : null,
            protocol_dose_unit: item.protocol_dose_unit,
            protocol_dose_text: item.protocol_dose_text,
            source_resource_id: item.source_resource_id ?? item.protocol_item_id,
            dilutions: (item.chemotherapy_protocol_dilutions ?? []).map((dilution) => ({
                medicine_id: dilution.medicine_id,
                form: dilution.form,
                dose: dilution.dose != null ? Number(dilution.dose) : null,
                dose_unit: dilution.dose_unit,
                dilution_volume: dilution.dilution_volume != null ? Number(dilution.dilution_volume) : null,
                dilution_volume_unit: dilution.dilution_volume_unit,
                diluent: dilution.diluent,
                comment: dilution.comment,
                source_resource_id: dilution.source_resource_id ?? dilution.protocol_dilution_id
            }))
        }));

        await this.validatePersonalizedStructure(dto, days, items);

        const newProtocolId = await prisma.$transaction(async (tx) => {

            const protocolId = await this.repository.generateRegimenProtocolId(tx);

            const regimenCode = await this.resolveUniqueRegimenCode(tx, source.regimen_code, organizationId, protocolId);

            await this.repository.createRegimenProtocol(tx, {
                protocol_id: protocolId,
                regimen_code: regimenCode,
                regimen_name: dto.regimen_name ?? source.regimen_name,
                protocol_version: dto.protocol_version ?? "v1",
                protocol_type: PROTOCOL_TYPE.PERSONALIZED,
                organization_id: organizationId,
                protocol_reference: source.protocol_id,
                original_protocol: source.original_protocol ?? source.protocol_id,
                source_resource_id: source.protocol_id,
                cancer_type_id: source.cancer_type_id,
                subtype_id: source.subtype_id,
                treatment_intent: dto.treatment_intent ?? source.treatment_intent,
                standard_cycles: dto.standard_cycles ?? source.standard_cycles,
                cycle_interval_days: dto.cycle_interval_days ?? source.cycle_interval_days,
                guideline_source: dto.guideline_source ?? source.guideline_source,
                notes: dto.notes ?? source.notes,
                composition: dto.composition ?? source.composition,
                additional_notes: dto.additional_notes ?? source.additional_notes,
                no_of_days: dto.no_of_days ?? source.no_of_days,
                day_care_referred: dto.day_care_referred ?? source.day_care_referred,
                create_day_care_appointment: dto.create_day_care_appointment ?? source.create_day_care_appointment,
                // A fresh personalized copy starts as an inactive draft - it
                // only becomes selectable for treatment after activation.
                active_status: PROTOCOL_ACTIVE_STATUS.INACTIVE
            });

            await this.applyStructure(tx, protocolId, { days, items }, [], [], actingUserId);

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol",
                entity_id: protocolId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({
                    source_protocol_id: source.protocol_id,
                    organization_id: organizationId,
                    regimen_code: regimenCode,
                    protocol_version: dto.protocol_version ?? "v1",
                    day_count: days.length,
                    item_count: items.length
                })
            });

            return protocolId;

        }, { timeout: 30000 });

        return this.getPersonalizedProtocol(newProtocolId, organizationId);

    }

    async updatePersonalizedProtocol(protocolId: string, organizationId: string, actingUserId: string, dto: UpdatePersonalizedProtocolDto) {

        if (!organizationId) {
            throw new Error("Your account is not associated with a hospital/organization");
        }

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        const days: PersonalizationDayInput[] = dto.days ?? (protocol.chemotherapy_regimen_protocol_days ?? []).map((day) => ({
            day_number: day.day_number,
            day_sequence: day.day_sequence,
            same_as_day_one: day.same_as_day_one,
            source_day_resource_id: day.source_day_resource_id ?? day.protocol_day_id
        }));

        const items: PersonalizationItemInput[] = dto.items ?? (protocol.chemotherapy_regimen_protocol_items ?? []).map((item) => ({
            medicine_id: item.medicine_id,
            drug_role: item.drug_role as PersonalizationItemInput["drug_role"],
            drug_sequence: item.drug_sequence,
            drug_type: item.drug_type,
            dosage: item.dosage != null ? Number(item.dosage) : null,
            dosage_unit: item.dosage_unit,
            dose_calculation_method: item.dose_calculation_method,
            administration_route: item.administration_route,
            infusion_type: item.infusion_type,
            infusion_duration_minutes: item.infusion_duration_minutes,
            administration_day: item.administration_day,
            cycle_day: item.cycle_day,
            frequency: item.frequency,
            timing_relative_to_primary: item.timing_relative_to_primary,
            remarks: item.remarks,
            drug_brand_name: item.drug_brand_name,
            protocol_dose: item.protocol_dose != null ? Number(item.protocol_dose) : null,
            protocol_dose_unit: item.protocol_dose_unit,
            protocol_dose_text: item.protocol_dose_text,
            source_resource_id: item.source_resource_id ?? item.protocol_item_id,
            dilutions: (item.chemotherapy_protocol_dilutions ?? []).map((dilution) => ({
                medicine_id: dilution.medicine_id,
                form: dilution.form,
                dose: dilution.dose != null ? Number(dilution.dose) : null,
                dose_unit: dilution.dose_unit,
                dilution_volume: dilution.dilution_volume != null ? Number(dilution.dilution_volume) : null,
                dilution_volume_unit: dilution.dilution_volume_unit,
                diluent: dilution.diluent,
                comment: dilution.comment,
                source_resource_id: dilution.source_resource_id ?? dilution.protocol_dilution_id
            }))
        }));

        await this.validatePersonalizedStructure(dto, days, items);

        const existingDays = protocol.chemotherapy_regimen_protocol_days;
        const existingItems = protocol.chemotherapy_regimen_protocol_items;

        await prisma.$transaction(async (tx) => {

            const protocolChanges = {
                ...(dto.regimen_name !== undefined ? { regimen_name: dto.regimen_name } : {}),
                ...(dto.treatment_intent !== undefined ? { treatment_intent: dto.treatment_intent } : {}),
                ...(dto.standard_cycles !== undefined ? { standard_cycles: dto.standard_cycles } : {}),
                ...(dto.cycle_interval_days !== undefined ? { cycle_interval_days: dto.cycle_interval_days } : {}),
                ...(dto.guideline_source !== undefined ? { guideline_source: dto.guideline_source } : {}),
                ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
                ...(dto.composition !== undefined ? { composition: dto.composition } : {}),
                ...(dto.additional_notes !== undefined ? { additional_notes: dto.additional_notes } : {}),
                ...(dto.no_of_days !== undefined ? { no_of_days: dto.no_of_days } : {}),
                ...(dto.day_care_referred !== undefined ? { day_care_referred: dto.day_care_referred } : {}),
                ...(dto.create_day_care_appointment !== undefined ? { create_day_care_appointment: dto.create_day_care_appointment } : {})
            };

            if (Object.keys(protocolChanges).length > 0) {
                await this.repository.updateRegimenProtocol(tx, protocolId, protocolChanges);
            }

            await this.applyStructure(tx, protocolId, { days, items }, existingDays, existingItems, actingUserId);

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol",
                entity_id: protocolId,
                action: AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({
                    ...protocolChanges,
                    day_count: days.length,
                    item_count: items.length
                })
            });

        }, { timeout: 30000 });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async addPersonalizedProtocolItem(protocolId: string, organizationId: string, actingUserId: string, dto: AddPersonalizedProtocolItemDto) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        await this.validatePersonalizedStructure({}, [], [dto]);

        await prisma.$transaction(async (tx) => {

            const itemId = await this.repository.generateRegimenProtocolItemId(tx);

            await this.repository.createRegimenProtocolItem(tx, {
                protocol_item_id: itemId,
                protocol_id: protocolId,
                medicine_id: dto.medicine_id,
                drug_role: dto.drug_role ?? "PRIMARY",
                drug_sequence: dto.drug_sequence,
                drug_type: dto.drug_type ?? null,
                dosage: dto.dosage ?? null,
                dosage_unit: dto.dosage_unit ?? null,
                dose_calculation_method: dto.dose_calculation_method ?? null,
                administration_route: dto.administration_route ?? null,
                infusion_type: dto.infusion_type ?? null,
                infusion_duration_minutes: dto.infusion_duration_minutes ?? null,
                administration_day: dto.administration_day ?? null,
                cycle_day: dto.cycle_day ?? null,
                frequency: dto.frequency ?? null,
                timing_relative_to_primary: dto.timing_relative_to_primary ?? null,
                remarks: dto.remarks ?? null,
                drug_brand_name: dto.drug_brand_name ?? null,
                protocol_dose: dto.protocol_dose ?? null,
                protocol_dose_unit: dto.protocol_dose_unit ?? null,
                protocol_dose_text: dto.protocol_dose_text ?? null,
                source_resource_id: dto.source_resource_id ?? null,
                active_status: dto.active_status ?? PROTOCOL_ACTIVE_STATUS.ACTIVE
            });

            if (dto.dilutions && dto.dilutions.length > 0) {

                for (const dilution of dto.dilutions) {

                    const dilutionId = await this.repository.generateRegimenProtocolDilutionId(tx);

                    await this.repository.createRegimenProtocolDilution(tx, {
                        protocol_dilution_id: dilutionId,
                        protocol_id: protocolId,
                        protocol_item_id: itemId,
                        medicine_id: dilution.medicine_id ?? null,
                        form: dilution.form ?? null,
                        dose: dilution.dose ?? null,
                        dose_unit: dilution.dose_unit ?? null,
                        dilution_volume: dilution.dilution_volume ?? null,
                        dilution_volume_unit: dilution.dilution_volume_unit ?? null,
                        diluent: dilution.diluent ?? null,
                        comment: dilution.comment ?? null,
                        source_resource_id: dilution.source_resource_id ?? null,
                        active_status: dilution.active_status ?? PROTOCOL_ACTIVE_STATUS.ACTIVE,
                        created_by: actingUserId
                    });

                }

            }

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol_items",
                entity_id: itemId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ protocol_id: protocolId, medicine_id: dto.medicine_id, drug_role: dto.drug_role ?? "PRIMARY" })
            });

        }, { timeout: 20000 });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async updatePersonalizedProtocolItem(protocolId: string, protocolItemId: string, organizationId: string, actingUserId: string, dto: UpdatePersonalizedProtocolItemDto) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        const item = await this.repository.findRegimenProtocolItemById(protocolItemId);

        if (!item || item.protocol_id !== protocolId) {
            throw new Error("Protocol item not found on this protocol");
        }

        const itemChanges = {
            ...(dto.medicine_id !== undefined ? { medicine_id: dto.medicine_id } : {}),
            ...(dto.drug_role !== undefined ? { drug_role: dto.drug_role } : {}),
            ...(dto.drug_sequence !== undefined ? { drug_sequence: dto.drug_sequence } : {}),
            ...(dto.drug_type !== undefined ? { drug_type: dto.drug_type } : {}),
            ...(dto.dosage !== undefined ? { dosage: dto.dosage } : {}),
            ...(dto.dosage_unit !== undefined ? { dosage_unit: dto.dosage_unit } : {}),
            ...(dto.dose_calculation_method !== undefined ? { dose_calculation_method: dto.dose_calculation_method } : {}),
            ...(dto.administration_route !== undefined ? { administration_route: dto.administration_route } : {}),
            ...(dto.infusion_type !== undefined ? { infusion_type: dto.infusion_type } : {}),
            ...(dto.infusion_duration_minutes !== undefined ? { infusion_duration_minutes: dto.infusion_duration_minutes } : {}),
            ...(dto.administration_day !== undefined ? { administration_day: dto.administration_day } : {}),
            ...(dto.cycle_day !== undefined ? { cycle_day: dto.cycle_day } : {}),
            ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
            ...(dto.timing_relative_to_primary !== undefined ? { timing_relative_to_primary: dto.timing_relative_to_primary } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
            ...(dto.drug_brand_name !== undefined ? { drug_brand_name: dto.drug_brand_name } : {}),
            ...(dto.protocol_dose !== undefined ? { protocol_dose: dto.protocol_dose } : {}),
            ...(dto.protocol_dose_unit !== undefined ? { protocol_dose_unit: dto.protocol_dose_unit } : {}),
            ...(dto.protocol_dose_text !== undefined ? { protocol_dose_text: dto.protocol_dose_text } : {}),
            ...(dto.active_status !== undefined ? { active_status: dto.active_status } : {})
        };

        if (itemChanges.medicine_id !== undefined) {
            const medicine = await this.repository.findActiveMedicineById(itemChanges.medicine_id as string);
            if (!medicine) {
                throw new Error(`Medicine not found or inactive: ${itemChanges.medicine_id}`);
            }
        }

        await prisma.$transaction(async (tx) => {

            await this.repository.updateRegimenProtocolItem(tx, protocolItemId, itemChanges);

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol_items",
                entity_id: protocolItemId,
                action: AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                change_summary: diffFields(item, itemChanges)
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async removePersonalizedProtocolItem(protocolId: string, protocolItemId: string, organizationId: string, actingUserId: string) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        const item = await this.repository.findRegimenProtocolItemById(protocolItemId);

        if (!item || item.protocol_id !== protocolId) {
            throw new Error("Protocol item not found on this protocol");
        }

        await prisma.$transaction(async (tx) => {

            // Deactivate the item together with any dilutions that hang off it
            // so nothing on the cloned hierarchy stays "active" under a
            // removed drug.
            const dilutions = await tx.chemotherapy_protocol_dilutions.findMany({
                where: { protocol_item_id: protocolItemId, active_status: 1 }
            });

            for (const dilution of dilutions) {
                await this.repository.deactivateRegimenProtocolDilution(tx, dilution.protocol_dilution_id);
            }

            await this.repository.deactivateRegimenProtocolItem(tx, protocolItemId);

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol_items",
                entity_id: protocolItemId,
                action: AUDIT_ACTION.DEACTIVATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ protocol_id: protocolId, medicine_id: item.medicine_id, deactivated_dilutions: dilutions.length })
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async addPersonalizedProtocolDay(protocolId: string, organizationId: string, actingUserId: string, dto: AddPersonalizedProtocolDayDto) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        await this.validatePersonalizedStructure({}, [dto], (protocol.chemotherapy_regimen_protocol_items ?? []).map((i) => ({
            medicine_id: i.medicine_id,
            drug_sequence: i.drug_sequence
        })));

        const existingDays = await this.repository.findRegimenProtocolDaysByProtocolId(protocolId);

        if (existingDays.some((d) => d.day_number === dto.day_number && (d.active_status ?? 1) === PROTOCOL_ACTIVE_STATUS.ACTIVE)) {
            throw new Error(`Duplicate day_number: day ${dto.day_number} already exists on this protocol`);
        }

        await prisma.$transaction(async (tx) => {

            const dayId = await this.repository.generateRegimenProtocolDayId(tx);

            await this.repository.createRegimenProtocolDay(tx, {
                protocol_day_id: dayId,
                protocol_id: protocolId,
                day_number: dto.day_number,
                day_sequence: dto.day_sequence ?? null,
                same_as_day_one: dto.same_as_day_one ?? false,
                source_day_resource_id: dto.source_day_resource_id ?? null,
                active_status: dto.active_status ?? PROTOCOL_ACTIVE_STATUS.ACTIVE,
                created_by: actingUserId,
                updated_by: actingUserId
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol_days",
                entity_id: dayId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ protocol_id: protocolId, day_number: dto.day_number })
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async updatePersonalizedProtocolDay(protocolId: string, protocolDayId: string, organizationId: string, actingUserId: string, dto: UpdatePersonalizedProtocolDayDto) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        const day = await this.repository.findRegimenProtocolDayById(protocolDayId);

        if (!day || day.protocol_id !== protocolId) {
            throw new Error("Protocol day not found on this protocol");
        }

        const dayChanges = {
            ...(dto.day_number !== undefined ? { day_number: dto.day_number } : {}),
            ...(dto.day_sequence !== undefined ? { day_sequence: dto.day_sequence } : {}),
            ...(dto.same_as_day_one !== undefined ? { same_as_day_one: dto.same_as_day_one } : {}),
            ...(dto.active_status !== undefined ? { active_status: dto.active_status } : {}),
            updated_by: actingUserId
        };

        await prisma.$transaction(async (tx) => {

            await this.repository.updateRegimenProtocolDay(tx, protocolDayId, dayChanges);

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol_days",
                entity_id: protocolDayId,
                action: AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                change_summary: diffFields(day, dayChanges)
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async removePersonalizedProtocolDay(protocolId: string, protocolDayId: string, organizationId: string, actingUserId: string) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        const day = await this.repository.findRegimenProtocolDayById(protocolDayId);

        if (!day || day.protocol_id !== protocolId) {
            throw new Error("Protocol day not found on this protocol");
        }

        await prisma.$transaction(async (tx) => {

            await this.repository.deactivateRegimenProtocolDay(tx, protocolDayId);

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol_days",
                entity_id: protocolDayId,
                action: AUDIT_ACTION.DEACTIVATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ protocol_id: protocolId, day_number: day.day_number })
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async addPersonalizedProtocolDilution(protocolId: string, protocolItemId: string, organizationId: string, actingUserId: string, dto: AddPersonalizedProtocolDilutionDto) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        const item = await this.repository.findRegimenProtocolItemById(protocolItemId);

        if (!item || item.protocol_id !== protocolId) {
            throw new Error("Protocol item not found on this protocol");
        }

        if (dto.medicine_id) {

            const medicine = await this.repository.findActiveMedicineById(dto.medicine_id);

            if (!medicine) {
                throw new Error(`Medicine not found or inactive: ${dto.medicine_id}`);
            }

        }

        await prisma.$transaction(async (tx) => {

            const dilutionId = await this.repository.generateRegimenProtocolDilutionId(tx);

            await this.repository.createRegimenProtocolDilution(tx, {
                protocol_dilution_id: dilutionId,
                protocol_id: protocolId,
                protocol_item_id: protocolItemId,
                medicine_id: dto.medicine_id ?? null,
                form: dto.form ?? null,
                dose: dto.dose ?? null,
                dose_unit: dto.dose_unit ?? null,
                dilution_volume: dto.dilution_volume ?? null,
                dilution_volume_unit: dto.dilution_volume_unit ?? null,
                diluent: dto.diluent ?? null,
                comment: dto.comment ?? null,
                source_resource_id: dto.source_resource_id ?? null,
                active_status: dto.active_status ?? PROTOCOL_ACTIVE_STATUS.ACTIVE,
                created_by: actingUserId
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_protocol_dilutions",
                entity_id: dilutionId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ protocol_id: protocolId, protocol_item_id: protocolItemId, medicine_id: dto.medicine_id ?? null })
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async updatePersonalizedProtocolDilution(protocolId: string, protocolItemId: string, protocolDilutionId: string, organizationId: string, actingUserId: string, dto: UpdatePersonalizedProtocolDilutionDto) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        const item = await this.repository.findRegimenProtocolItemById(protocolItemId);

        if (!item || item.protocol_id !== protocolId) {
            throw new Error("Protocol item not found on this protocol");
        }

        const dilution = await this.repository.findRegimenProtocolDilutionById(protocolDilutionId);

        if (!dilution || dilution.protocol_id !== protocolId || dilution.protocol_item_id !== protocolItemId) {
            throw new Error("Protocol dilution not found on this item");
        }

        const dilutionChanges = {
            ...(dto.medicine_id !== undefined ? { medicine_id: dto.medicine_id } : {}),
            ...(dto.form !== undefined ? { form: dto.form } : {}),
            ...(dto.dose !== undefined ? { dose: dto.dose } : {}),
            ...(dto.dose_unit !== undefined ? { dose_unit: dto.dose_unit } : {}),
            ...(dto.dilution_volume !== undefined ? { dilution_volume: dto.dilution_volume } : {}),
            ...(dto.dilution_volume_unit !== undefined ? { dilution_volume_unit: dto.dilution_volume_unit } : {}),
            ...(dto.diluent !== undefined ? { diluent: dto.diluent } : {}),
            ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
            ...(dto.active_status !== undefined ? { active_status: dto.active_status } : {}),
            updated_by: actingUserId
        };

        if (dilutionChanges.medicine_id !== undefined && dilutionChanges.medicine_id !== null) {

            const medicine = await this.repository.findActiveMedicineById(dilutionChanges.medicine_id as string);

            if (!medicine) {
                throw new Error(`Medicine not found or inactive: ${dilutionChanges.medicine_id}`);
            }

        }

        await prisma.$transaction(async (tx) => {

            await this.repository.updateRegimenProtocolDilution(tx, protocolDilutionId, dilutionChanges);

            await logAudit(tx, {
                entity_type: "chemotherapy_protocol_dilutions",
                entity_id: protocolDilutionId,
                action: AUDIT_ACTION.UPDATE,
                performed_by: actingUserId,
                change_summary: diffFields(dilution, dilutionChanges)
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async removePersonalizedProtocolDilution(protocolId: string, protocolItemId: string, protocolDilutionId: string, organizationId: string, actingUserId: string) {

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        await this.assertNotClinicallyUsed(protocolId);

        const item = await this.repository.findRegimenProtocolItemById(protocolItemId);

        if (!item || item.protocol_id !== protocolId) {
            throw new Error("Protocol item not found on this protocol");
        }

        const dilution = await this.repository.findRegimenProtocolDilutionById(protocolDilutionId);

        if (!dilution || dilution.protocol_id !== protocolId || dilution.protocol_item_id !== protocolItemId) {
            throw new Error("Protocol dilution not found on this item");
        }

        await prisma.$transaction(async (tx) => {

            await this.repository.deactivateRegimenProtocolDilution(tx, protocolDilutionId);

            await logAudit(tx, {
                entity_type: "chemotherapy_protocol_dilutions",
                entity_id: protocolDilutionId,
                action: AUDIT_ACTION.DEACTIVATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({ protocol_id: protocolId, protocol_item_id: protocolItemId, medicine_id: dilution.medicine_id })
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async activatePersonalizedProtocol(protocolId: string, organizationId: string, actingUserId: string) {

        if (!organizationId) {
            throw new Error("Your account is not associated with a hospital/organization");
        }

        const protocol = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(protocol, organizationId);

        const days: PersonalizationDayInput[] = (protocol.chemotherapy_regimen_protocol_days ?? []).map((day) => ({
            day_number: day.day_number,
            day_sequence: day.day_sequence,
            same_as_day_one: day.same_as_day_one
        }));

        const items: PersonalizationItemInput[] = (protocol.chemotherapy_regimen_protocol_items ?? []).map((item) => ({
            medicine_id: item.medicine_id,
            drug_role: item.drug_role as PersonalizationItemInput["drug_role"],
            drug_sequence: item.drug_sequence,
            dosage: item.dosage != null ? Number(item.dosage) : null,
            dosage_unit: item.dosage_unit
        }));

        await this.validatePersonalizedStructure({}, days, items);

        if ((protocol.active_status ?? 1) === PROTOCOL_ACTIVE_STATUS.ACTIVE) {
            return this.getPersonalizedProtocol(protocolId, organizationId);
        }

        await prisma.$transaction(async (tx) => {

            await this.repository.updateRegimenProtocol(tx, protocolId, { active_status: PROTOCOL_ACTIVE_STATUS.ACTIVE });

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol",
                entity_id: protocolId,
                action: AUDIT_ACTION.STATUS_CHANGE,
                performed_by: actingUserId,
                change_summary: summarizeStatusChange("DRAFT", "ACTIVE", "Protocol validated and published")
            });

        });

        return this.getPersonalizedProtocol(protocolId, organizationId);

    }

    async createPersonalizedProtocolVersion(protocolId: string, organizationId: string, actingUserId: string, dto: VersionPersonalizedProtocolDto) {

        if (!organizationId) {
            throw new Error("Your account is not associated with a hospital/organization");
        }

        const current = await this.repository.findPersonalizedProtocolById(protocolId, organizationId);

        this.assertPersonalizedOwner(current, organizationId);

        const nextVersion = this.incrementVersion(current.protocol_version);

        const days: PersonalizationDayInput[] = (current.chemotherapy_regimen_protocol_days ?? []).map((day) => ({
            day_number: day.day_number,
            day_sequence: day.day_sequence,
            same_as_day_one: day.same_as_day_one,
            source_day_resource_id: day.source_day_resource_id ?? day.protocol_day_id
        }));

        const items: PersonalizationItemInput[] = (current.chemotherapy_regimen_protocol_items ?? []).map((item) => ({
            medicine_id: item.medicine_id,
            drug_role: item.drug_role as PersonalizationItemInput["drug_role"],
            drug_sequence: item.drug_sequence,
            drug_type: item.drug_type,
            dosage: item.dosage != null ? Number(item.dosage) : null,
            dosage_unit: item.dosage_unit,
            dose_calculation_method: item.dose_calculation_method,
            administration_route: item.administration_route,
            infusion_type: item.infusion_type,
            infusion_duration_minutes: item.infusion_duration_minutes,
            administration_day: item.administration_day,
            cycle_day: item.cycle_day,
            frequency: item.frequency,
            timing_relative_to_primary: item.timing_relative_to_primary,
            remarks: item.remarks,
            drug_brand_name: item.drug_brand_name,
            protocol_dose: item.protocol_dose != null ? Number(item.protocol_dose) : null,
            protocol_dose_unit: item.protocol_dose_unit,
            protocol_dose_text: item.protocol_dose_text,
            source_resource_id: item.source_resource_id ?? item.protocol_item_id,
            dilutions: (item.chemotherapy_protocol_dilutions ?? []).map((dilution) => ({
                medicine_id: dilution.medicine_id,
                form: dilution.form,
                dose: dilution.dose != null ? Number(dilution.dose) : null,
                dose_unit: dilution.dose_unit,
                dilution_volume: dilution.dilution_volume != null ? Number(dilution.dilution_volume) : null,
                dilution_volume_unit: dilution.dilution_volume_unit,
                diluent: dilution.diluent,
                comment: dilution.comment,
                source_resource_id: dilution.source_resource_id ?? dilution.protocol_dilution_id
            }))
        }));

        await this.validatePersonalizedStructure({}, days, items);

        const newProtocolId = await prisma.$transaction(async (tx) => {

            const versionProtocolId = await this.repository.generateRegimenProtocolId(tx);

            const regimenCode = await this.resolveUniqueRegimenCode(tx, current.regimen_code, organizationId, versionProtocolId);

            await this.repository.createRegimenProtocol(tx, {
                protocol_id: versionProtocolId,
                regimen_code: regimenCode,
                regimen_name: current.regimen_name,
                protocol_version: nextVersion,
                protocol_type: PROTOCOL_TYPE.PERSONALIZED,
                organization_id: organizationId,
                protocol_reference: current.protocol_id,
                original_protocol: current.original_protocol ?? current.protocol_id,
                source_resource_id: current.protocol_id,
                cancer_type_id: current.cancer_type_id,
                subtype_id: current.subtype_id,
                treatment_intent: current.treatment_intent,
                standard_cycles: current.standard_cycles,
                cycle_interval_days: current.cycle_interval_days,
                guideline_source: current.guideline_source,
                notes: current.notes,
                composition: current.composition,
                additional_notes: current.additional_notes,
                no_of_days: current.no_of_days,
                day_care_referred: current.day_care_referred,
                create_day_care_appointment: current.create_day_care_appointment,
                active_status: PROTOCOL_ACTIVE_STATUS.INACTIVE
            });

            await this.applyStructure(tx, versionProtocolId, { days, items }, [], [], actingUserId);

            const supersedeNote = dto.reason
                ? `Superseded by ${versionProtocolId}: ${dto.reason}`
                : `Superseded by ${versionProtocolId}`;

            await this.repository.updateRegimenProtocol(tx, current.protocol_id, {
                active_status: PROTOCOL_ACTIVE_STATUS.INACTIVE,
                notes: appendNote(current.notes, supersedeNote)
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol",
                entity_id: versionProtocolId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                change_summary: summarizeCreate({
                    source_protocol_id: current.protocol_id,
                    organization_id: organizationId,
                    regimen_code: regimenCode,
                    protocol_version: nextVersion,
                    day_count: days.length,
                    item_count: items.length
                })
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_regimen_protocol",
                entity_id: current.protocol_id,
                action: AUDIT_ACTION.STATUS_CHANGE,
                performed_by: actingUserId,
                change_summary: summarizeStatusChange("ACTIVE", "DRAFT", supersedeNote)
            });

            return versionProtocolId;

        }, { timeout: 30000 });

        return this.getPersonalizedProtocol(newProtocolId, organizationId);

    }

    private async repository_findStagingDetailOrThrow(stagingDetailId: string) {

        const staging = await this.oncologyRepository.findStagingDetailById(stagingDetailId);

        if (!staging) {
            throw new Error("Staging detail not found");
        }

        return staging;

    }

    // ---------------------------------------------------------------
    // Plan CRUD
    // ---------------------------------------------------------------

    async createPlan(dto: CreatePlanDto, actingUserId: string, organizationId?: string | null) {

        if (dto.confirm_suggested_therapy !== true) {
            throw new Error("Explicit confirmation of the suggested therapy (or clinical rationale, if none was computed) is required before creating a chemotherapy plan");
        }

        const patient = await this.repository.findPatientById(dto.patient_id);

        if (!patient) {
            throw new Error("Patient not found");
        }

        const staging = await this.repository_findStagingDetailOrThrow(dto.staging_detail_id);

        if (staging.patient_id !== dto.patient_id) {
            throw new Error("The staging detail does not belong to this patient");
        }

        const diagnosis = await this.repository.findDiagnosisById(dto.diagnosis_id);

        if (!diagnosis) {
            throw new Error("Diagnosis not found");
        }

        const employee = await this.repository.findEmployeeById(dto.employee_id);

        if (!employee) {
            throw new Error("Doctor (employee) not found");
        }

        const department = await this.repository.findDepartmentById(dto.department_id);

        if (!department) {
            throw new Error("Department not found");
        }

        const branch = await this.repository.findBranchById(dto.branch_id);

        if (!branch) {
            throw new Error("Branch not found");
        }

        // If a protocol was picked, resolve its defaults - anything also
        // present in the request body (planned_cycles, cycle_interval_days,
        // plan_items, regimen_name/code) overrides the protocol's value.
        // This is a one-time copy: nothing here reads back from or writes to
        // chemotherapy_regimen_protocol after this point.
        let protocol: Awaited<ReturnType<ChemotherapyRepository["findRegimenProtocolById"]>> = null;

        if (dto.protocol_id) {

            protocol = await this.repository.findRegimenProtocolById(dto.protocol_id);

            if (!protocol) {
                throw new Error("Regimen protocol not found");
            }

            if (protocol.cancer_type_id !== staging.cancer_type_id) {
                throw new Error("Selected protocol does not match this patient's diagnosed cancer type");
            }

            if (protocol.subtype_id && protocol.subtype_id !== staging.cancer_subtype_id) {
                throw new Error("Selected protocol does not match this patient's diagnosed cancer subtype");
            }

            if (protocol.protocol_type === "PERSONALIZED") {

                // Personalized protocols are organization-scoped: only their
                // owning organization may use them, and only when published
                // (active). Generics stay globally selectable.
                if (protocol.active_status !== PROTOCOL_ACTIVE_STATUS.ACTIVE) {
                    throw new Error("Selected personalized protocol is not active");
                }

                if (!organizationId || protocol.organization_id !== organizationId) {
                    throw new Error("Selected personalized protocol does not belong to your organization");
                }

            }

        }

        const resolvedRegimenName = dto.regimen_name ?? protocol?.regimen_name;
        const resolvedRegimenCode = dto.regimen_code ?? protocol?.regimen_code ?? null;
        const resolvedPlannedCycles = dto.planned_cycles ?? protocol?.standard_cycles ?? null;
        const resolvedCycleIntervalDays = dto.cycle_interval_days ?? protocol?.cycle_interval_days ?? null;

        const resolvedPlanItems: PlanItemInputDto[] = (dto.plan_items && dto.plan_items.length > 0)
            ? dto.plan_items
            : (protocol?.chemotherapy_regimen_protocol_items ?? []).map((item) => ({
                medicine_id: item.medicine_id,
                drug_role: item.drug_role as PlanItemInputDto["drug_role"],
                drug_sequence: item.drug_sequence,
                drug_type: item.drug_type,
                dosage: item.dosage != null ? Number(item.dosage) : null,
                dosage_unit: item.dosage_unit,
                administration_route: item.administration_route,
                infusion_type: item.infusion_type,
                infusion_duration_minutes: item.infusion_duration_minutes,
                administration_day: item.administration_day,
                cycle_day: item.cycle_day,
                frequency: item.frequency,
                remarks: item.remarks
            }));

        if (!resolvedRegimenName) {
            throw new Error("regimen_name is required (or select a protocol_id to default it)");
        }

        if (!resolvedPlannedCycles || resolvedPlannedCycles < 1) {
            throw new Error("planned_cycles must be at least 1 (or select a protocol with a standard cycle count)");
        }

        if (resolvedPlanItems.length === 0) {
            throw new Error("At least one plan item (drug) is required (or select a protocol_id)");
        }

        for (const item of resolvedPlanItems) {

            const medicine = await this.repository.findMedicineById(item.medicine_id);

            if (!medicine) {
                throw new Error(`Medicine not found: ${item.medicine_id}`);
            }

        }

        // Resolve patient_history_id: use what was passed (validated to
        // belong to this patient), else the patient's most recent record,
        // else auto-provision a minimal one - the column is NOT NULL but
        // almost no patient has one yet (no intake module writes it).
        let patientHistoryId = dto.patient_history_id ?? null;

        if (patientHistoryId) {

            const history = await this.repository.findPatientHistoryById(patientHistoryId);

            if (!history) {
                throw new Error("patient_history_id not found");
            }

            if (history.patient_id !== dto.patient_id) {
                throw new Error("The supplied patient_history_id does not belong to this patient");
            }

        } else {

            const existingHistory = await this.repository.findMostRecentPatientHistory(dto.patient_id);
            patientHistoryId = existingHistory?.patient_history_id ?? null;

        }

        const planId = await prisma.$transaction(async (tx) => {

            let finalPatientHistoryId: string;

            if (patientHistoryId) {

                finalPatientHistoryId = patientHistoryId;

            } else {

                finalPatientHistoryId = await generateId(tx, "PATIENT_HISTORY");

                await this.repository.createPatientHistory(tx, {
                    patient_history_id: finalPatientHistoryId,
                    patient_id: dto.patient_id,
                    visit_type: "Oncology",
                    visit_date: new Date(),
                    branch_id: dto.branch_id,
                    department_id: dto.department_id,
                    employee_id: dto.employee_id,
                    diagnosis_id: dto.diagnosis_id
                });

            }

            const newPlanId = await this.repository.generatePlanId(tx);

            await this.repository.createPlan(tx, {
                chemotherapy_plan_id: newPlanId,
                patient_history_id: finalPatientHistoryId,
                patient_id: dto.patient_id,
                encounter_no: dto.encounter_no ?? null,
                appointment_id: dto.appointment_id ?? null,
                diagnosis_id: dto.diagnosis_id,
                employee_id: dto.employee_id,
                department_id: dto.department_id,
                branch_id: dto.branch_id,
                user_id: actingUserId,
                source_protocol_id: protocol?.protocol_id ?? null,
                regimen_name: resolvedRegimenName,
                regimen_code: resolvedRegimenCode,
                protocol_name: dto.protocol_name ?? protocol?.regimen_name ?? null,
                protocol_version: dto.protocol_version ?? protocol?.protocol_version ?? null,
                treatment_intent: dto.treatment_intent ?? protocol?.treatment_intent ?? null,
                cancer_stage: staging.clinical_stage ?? null,
                cancer_type: staging.cancer_types.cancer_type,
                cancer_subtype: staging.cancer_subtypes.subtype_name,
                cancer_type_id: staging.cancer_type_id,
                subtype_id: staging.cancer_subtype_id,
                staging_detail_id: staging.staging_detail_id,
                ecog_status: dto.ecog_status ?? null,
                karnofsky_score: dto.karnofsky_score ?? null,
                planned_cycles: resolvedPlannedCycles,
                completed_cycles: 0,
                cycle_interval_days: resolvedCycleIntervalDays,
                treatment_start_date: new Date(dto.treatment_start_date),
                expected_end_date: dto.expected_end_date ? new Date(dto.expected_end_date) : null,
                treatment_status: PLAN_STATUS.PLANNED,
                consent_taken: dto.consent_taken ?? false,
                consent_date: dto.consent_date ? new Date(dto.consent_date) : null,
                insurance_type: dto.insurance_type ?? null,
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });

            for (const item of resolvedPlanItems) {

                const itemId = await this.repository.generatePlanItemId(tx);

                await this.repository.createPlanItem(tx, {
                    chemotherapy_plan_item_id: itemId,
                    chemotherapy_plan_id: newPlanId,
                    medicine_id: item.medicine_id,
                    drug_role: item.drug_role ?? "PRIMARY",
                    drug_sequence: item.drug_sequence,
                    drug_type: item.drug_type ?? null,
                    protocol_dose: item.dosage ?? null,
                    protocol_dose_unit: item.dosage_unit ?? null,
                    dose_calculation_method: item.dose_calculation_method ?? null,
                    calculated_dose: item.calculated_dose ?? null,
                    administration_route: item.administration_route ?? null,
                    formulation: item.formulation ?? null,
                    infusion_type: item.infusion_type ?? null,
                    infusion_duration_minutes: item.infusion_duration_minutes ?? null,
                    infusion_rate: item.infusion_rate ?? null,
                    dilution_solution: item.dilution_solution ?? null,
                    dilution_volume: item.dilution_volume ?? null,
                    administration_day: item.administration_day ?? null,
                    cycle_day: item.cycle_day ?? null,
                    frequency: item.frequency ?? null,
                    maximum_dose: item.maximum_dose ?? null,
                    minimum_dose: item.minimum_dose ?? null,
                    dose_required: item.dose_required ?? true,
                    remarks: item.remarks ?? null,
                    created_by: actingUserId
                });

            }

            await logAudit(tx, {
                entity_type: "chemotherapy_plan",
                entity_id: newPlanId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: dto.patient_id,
                branch_id: dto.branch_id,
                change_summary: summarizeCreate({
                    regimen_name: resolvedRegimenName,
                    planned_cycles: resolvedPlannedCycles,
                    source_protocol_id: protocol?.protocol_id ?? null,
                    staging_detail_id: staging.staging_detail_id,
                    item_count: resolvedPlanItems.length
                })
            });

            return newPlanId;

        }, { timeout: 20000 });

        return this.getPlan(planId);

    }

    async getPlan(planId: string) {

        const plan = await this.repository.findPlanById(planId);

        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }

        return plan;

    }

    async listPlans(filters: PlanFilterQuery) {

        return this.repository.listPlans(filters);

    }

    /*
     * Latest saved plan for a patient, scoped like the encounters
     * /latest feed - deliberately NOT behind branchScope so the
     * patient-details page can show plan data regardless of which
     * branch recorded it or which branch the UI has selected.
     * Isolation mirrors getLatestEncountersForPatient: top-level
     * admins see every branch, everyone else is limited to their
     * ACTIVE user_branch_mapping branches, and zero mappings yields
     * null instead of a 403.
     */
    async getLatestPlanForPatient(patientId: string, userId: string, role: string) {

        const isTopLevelAdmin = TOP_LEVEL_ADMIN_ROLES.some(
            (r) => r.toLowerCase() === String(role ?? "").toLowerCase()
        );

        if (isTopLevelAdmin) {
            return this.repository.findLatestPlanForPatient(patientId, null);
        }

        const mappings = await this.repository.findActiveBranchMappingsForUser(userId);

        const branchIds = mappings.map((m) => String(m.branch_id));

        if (branchIds.length === 0) {
            return null;
        }

        return this.repository.findLatestPlanForPatient(patientId, branchIds);

    }

    async updatePlan(planId: string, dto: UpdatePlanDto, actingUserId: string) {

        const plan = await this.repository.findPlanForUpdate(prisma, planId);

        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }

        if (PLAN_TERMINAL_STATUSES.includes(plan.treatment_status as PlanStatus)) {
            throw new Error(`Cannot update a plan that is already ${plan.treatment_status}`);
        }

        const planChanges = {
            ...(dto.regimen_name !== undefined ? { regimen_name: dto.regimen_name } : {}),
            ...(dto.regimen_code !== undefined ? { regimen_code: dto.regimen_code } : {}),
            ...(dto.protocol_name !== undefined ? { protocol_name: dto.protocol_name } : {}),
            ...(dto.protocol_version !== undefined ? { protocol_version: dto.protocol_version } : {}),
            ...(dto.treatment_goal !== undefined ? { treatment_goal: dto.treatment_goal } : {}),
            ...(dto.treatment_intent !== undefined ? { treatment_intent: dto.treatment_intent } : {}),
            ...(dto.ecog_status !== undefined ? { ecog_status: dto.ecog_status } : {}),
            ...(dto.karnofsky_score !== undefined ? { karnofsky_score: dto.karnofsky_score } : {}),
            ...(dto.planned_cycles !== undefined ? { planned_cycles: dto.planned_cycles } : {}),
            ...(dto.cycle_interval_days !== undefined ? { cycle_interval_days: dto.cycle_interval_days } : {}),
            ...(dto.expected_end_date !== undefined ? { expected_end_date: dto.expected_end_date ? new Date(dto.expected_end_date) : null } : {}),
            ...(dto.consent_taken !== undefined ? { consent_taken: dto.consent_taken } : {}),
            ...(dto.consent_date !== undefined ? { consent_date: dto.consent_date ? new Date(dto.consent_date) : null } : {}),
            ...(dto.insurance_type !== undefined ? { insurance_type: dto.insurance_type } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {})
        };

        await prisma.$transaction(async (tx) => {

            await this.repository.updatePlan(tx, planId, planChanges);

            if (Object.keys(planChanges).length > 0) {

                await logAudit(tx, {
                    entity_type: "chemotherapy_plan",
                    entity_id: planId,
                    action: AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: plan.patient_id,
                    branch_id: plan.branch_id,
                    change_summary: diffFields(plan, planChanges)
                });

            }

        });

        return this.getPlan(planId);

    }

    async changePlanStatus(planId: string, dto: PlanStatusChangeDto, actingUserId: string) {

        const plan = await this.repository.findPlanForUpdate(prisma, planId);

        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }

        if (!isPlanStatus(dto.status)) {
            throw new Error(`status must be one of: ${Object.values(PLAN_STATUS).join(", ")}`);
        }

        const current = plan.treatment_status as PlanStatus;
        const allowed = PLAN_STATUS_TRANSITIONS[current] ?? [];

        if (!allowed.includes(dto.status)) {
            throw new Error(`Cannot transition plan from ${current} to ${dto.status}`);
        }

        if ((dto.status === PLAN_STATUS.CANCELLED || dto.status === PLAN_STATUS.DISCONTINUED) && !dto.reason?.trim()) {
            throw new Error(`A reason is required to mark a plan as ${dto.status}`);
        }

        await prisma.$transaction(async (tx) => {

            await this.repository.updatePlan(tx, planId, {
                treatment_status: dto.status,
                remarks: appendNote(plan.remarks, dto.reason ? `[${dto.status}] ${dto.reason}` : null)
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_plan",
                entity_id: planId,
                action: AUDIT_ACTION.STATUS_CHANGE,
                performed_by: actingUserId,
                patient_id: plan.patient_id,
                branch_id: plan.branch_id,
                change_summary: summarizeStatusChange(current, dto.status, dto.reason)
            });

        });

        return this.getPlan(planId);

    }

    // ---------------------------------------------------------------
    // Plan items
    // ---------------------------------------------------------------

    async addPlanItem(planId: string, dto: AddPlanItemDto, actingUserId: string) {

        const plan = await this.repository.findPlanForUpdate(prisma, planId);

        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }

        if (PLAN_TERMINAL_STATUSES.includes(plan.treatment_status as PlanStatus)) {
            throw new Error(`Cannot add a drug to a plan that is already ${plan.treatment_status}`);
        }

        const medicine = await this.repository.findMedicineById(dto.medicine_id);

        if (!medicine) {
            throw new Error("Medicine not found");
        }

        await prisma.$transaction(async (tx) => {

            const itemId = await this.repository.generatePlanItemId(tx);

            await this.repository.createPlanItem(tx, {
                chemotherapy_plan_item_id: itemId,
                chemotherapy_plan_id: planId,
                medicine_id: dto.medicine_id,
                drug_role: dto.drug_role ?? "PRIMARY",
                drug_sequence: dto.drug_sequence,
                drug_type: dto.drug_type ?? null,
                protocol_dose: dto.dosage ?? null,
                protocol_dose_unit: dto.dosage_unit ?? null,
                dose_calculation_method: dto.dose_calculation_method ?? null,
                calculated_dose: dto.calculated_dose ?? null,
                administration_route: dto.administration_route ?? null,
                formulation: dto.formulation ?? null,
                infusion_type: dto.infusion_type ?? null,
                infusion_duration_minutes: dto.infusion_duration_minutes ?? null,
                infusion_rate: dto.infusion_rate ?? null,
                dilution_solution: dto.dilution_solution ?? null,
                dilution_volume: dto.dilution_volume ?? null,
                administration_day: dto.administration_day ?? null,
                cycle_day: dto.cycle_day ?? null,
                frequency: dto.frequency ?? null,
                maximum_dose: dto.maximum_dose ?? null,
                minimum_dose: dto.minimum_dose ?? null,
                dose_required: dto.dose_required ?? true,
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_plan_items",
                entity_id: itemId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan.patient_id,
                branch_id: plan.branch_id,
                change_summary: summarizeCreate({ chemotherapy_plan_id: planId, medicine_id: dto.medicine_id, drug_role: dto.drug_role ?? "PRIMARY" })
            });

        });

        return this.getPlan(planId);

    }

    async updatePlanItem(planId: string, planItemId: string, dto: Partial<AddPlanItemDto>, actingUserId: string) {

        const plan = await this.repository.findPlanForUpdate(prisma, planId);

        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }

        if (plan.treatment_status !== PLAN_STATUS.PLANNED) {
            throw new Error("Plan items can only be edited while the plan is still PLANNED");
        }

        const item = await this.repository.findPlanItemById(planItemId);

        if (!item || item.chemotherapy_plan_id !== planId) {
            throw new Error("Plan item not found on this plan");
        }

        const itemChanges = {
            ...(dto.drug_role !== undefined ? { drug_role: dto.drug_role } : {}),
            ...(dto.drug_sequence !== undefined ? { drug_sequence: dto.drug_sequence } : {}),
            ...(dto.drug_type !== undefined ? { drug_type: dto.drug_type } : {}),
            ...(dto.dosage !== undefined ? { protocol_dose: dto.dosage } : {}),
            ...(dto.dosage_unit !== undefined ? { protocol_dose_unit: dto.dosage_unit } : {}),
            ...(dto.dose_calculation_method !== undefined ? { dose_calculation_method: dto.dose_calculation_method } : {}),
            ...(dto.calculated_dose !== undefined ? { calculated_dose: dto.calculated_dose } : {}),
            ...(dto.administration_route !== undefined ? { administration_route: dto.administration_route } : {}),
            ...(dto.infusion_duration_minutes !== undefined ? { infusion_duration_minutes: dto.infusion_duration_minutes } : {}),
            ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {})
        };

        await prisma.$transaction(async (tx) => {

            await this.repository.updatePlanItem(tx, planItemId, itemChanges);

            if (Object.keys(itemChanges).length > 0) {

                await logAudit(tx, {
                    entity_type: "chemotherapy_plan_items",
                    entity_id: planItemId,
                    action: AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: plan.patient_id,
                    branch_id: plan.branch_id,
                    change_summary: diffFields(item, itemChanges)
                });

            }

        });

        return this.getPlan(planId);

    }

    async removePlanItem(planId: string, planItemId: string, actingUserId: string) {

        const plan = await this.repository.findPlanForUpdate(prisma, planId);

        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }

        if (plan.treatment_status !== PLAN_STATUS.PLANNED) {
            throw new Error("Plan items can only be removed while the plan is still PLANNED");
        }

        const item = await this.repository.findPlanItemById(planItemId);

        if (!item || item.chemotherapy_plan_id !== planId) {
            throw new Error("Plan item not found on this plan");
        }

        await prisma.$transaction(async (tx) => {

            await this.repository.deactivatePlanItem(tx, planItemId);

            await logAudit(tx, {
                entity_type: "chemotherapy_plan_items",
                entity_id: planItemId,
                action: AUDIT_ACTION.DEACTIVATE,
                performed_by: actingUserId,
                patient_id: plan.patient_id,
                branch_id: plan.branch_id,
                change_summary: summarizeCreate({ medicine_id: item.medicine_id })
            });

        });

        return this.getPlan(planId);

    }

    // ---------------------------------------------------------------
    // Cycles
    // ---------------------------------------------------------------

    async createCycle(planId: string, dto: CreateCycleDto, actingUserId: string) {

        const plan = await this.repository.findPlanForUpdate(prisma, planId);

        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }

        if (PLAN_TERMINAL_STATUSES.includes(plan.treatment_status as PlanStatus)) {
            throw new Error(`Cannot create a cycle for a plan that is already ${plan.treatment_status}`);
        }

        if (!dto.cycle_number || dto.cycle_number < 1) {
            throw new Error("cycle_number must be at least 1");
        }

        const cycleId = await prisma.$transaction(async (tx) => {

            const newCycleId = await this.repository.generateCycleId(tx);

            await this.repository.createCycle(tx, {
                chemotherapy_cycle_id: newCycleId,
                chemotherapy_plan_id: planId,
                cycle_number: dto.cycle_number,
                cycle_day: dto.cycle_day ?? null,
                planned_date: new Date(dto.planned_date),
                cycle_interval_days: dto.cycle_interval_days ?? plan.cycle_interval_days ?? null,
                cycle_status: CYCLE_STATUS.PLANNED,
                completion_status: "PENDING"
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_cycle",
                entity_id: newCycleId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan.patient_id,
                branch_id: plan.branch_id,
                change_summary: summarizeCreate({ chemotherapy_plan_id: planId, cycle_number: dto.cycle_number, planned_date: dto.planned_date })
            });

            return newCycleId;

        });

        return this.getCycle(cycleId);

    }

    async getCycle(cycleId: string) {

        const cycle = await this.repository.findCycleById(cycleId);

        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }

        return cycle;

    }

    async listCyclesForPlan(planId: string) {

        const plan = await this.repository.findPlanForUpdate(prisma, planId);

        if (!plan) {
            throw new Error("Chemotherapy plan not found");
        }

        return this.repository.listCyclesForPlan(planId);

    }

    async updateCycle(cycleId: string, dto: UpdateCycleDto, actingUserId: string) {

        const cycle = await this.repository.findCycleForUpdate(prisma, cycleId);

        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }

        if (CYCLE_TERMINAL_STATUSES.includes(cycle.cycle_status as CycleStatus)) {
            throw new Error(`Cannot update a cycle that is already ${cycle.cycle_status}`);
        }

        const plan = await this.repository.findPlanForUpdate(prisma, cycle.chemotherapy_plan_id);

        const cycleChanges = {
            ...(dto.planned_date !== undefined ? { planned_date: new Date(dto.planned_date!) } : {}),
            ...(dto.treatment_delay !== undefined ? { treatment_delay: dto.treatment_delay } : {}),
            ...(dto.delay_days !== undefined ? { delay_days: dto.delay_days } : {}),
            ...(dto.delay_reason !== undefined ? { delay_reason: dto.delay_reason } : {}),
            ...(dto.rescheduled_date !== undefined ? { rescheduled_date: dto.rescheduled_date ? new Date(dto.rescheduled_date) : null } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {})
        };

        await prisma.$transaction(async (tx) => {

            await this.repository.updateCycle(tx, cycleId, cycleChanges);

            if (Object.keys(cycleChanges).length > 0) {

                await logAudit(tx, {
                    entity_type: "chemotherapy_cycle",
                    entity_id: cycleId,
                    action: AUDIT_ACTION.UPDATE,
                    performed_by: actingUserId,
                    patient_id: plan?.patient_id,
                    branch_id: plan?.branch_id,
                    change_summary: diffFields(cycle, cycleChanges)
                });

            }

        });

        return this.getCycle(cycleId);

    }

    async changeCycleStatus(cycleId: string, dto: CycleStatusChangeDto, actingUserId: string) {

        const cycle = await this.repository.findCycleForUpdate(prisma, cycleId);

        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }

        if (!isCycleStatus(dto.status)) {
            throw new Error(`status must be one of: ${Object.values(CYCLE_STATUS).join(", ")}`);
        }

        const current = cycle.cycle_status as CycleStatus;
        const allowed = CYCLE_STATUS_TRANSITIONS[current] ?? [];

        if (!allowed.includes(dto.status)) {
            throw new Error(`Cannot transition cycle from ${current} to ${dto.status}`);
        }

        if (dto.status === CYCLE_STATUS.CANCELLED && !dto.reason?.trim()) {
            throw new Error("A reason is required to cancel a cycle");
        }

        const planForContext = await this.repository.findPlanForUpdate(prisma, cycle.chemotherapy_plan_id);

        await prisma.$transaction(async (tx) => {

            const now = new Date();

            await this.repository.updateCycle(tx, cycleId, {
                cycle_status: dto.status,
                ...(dto.status === CYCLE_STATUS.APPROVED ? { physician_approved: true, approval_date: now } : {}),
                ...(dto.status === CYCLE_STATUS.COMPLETED ? { cycle_completed: true, completion_date: now, completion_status: "COMPLETED" } : {}),
                ...(dto.status === CYCLE_STATUS.CANCELLED ? { cancellation_reason: dto.reason, completion_status: "CANCELLED" } : {}),
                ...(dto.status === CYCLE_STATUS.DELAYED ? { treatment_delay: true, delay_reason: dto.reason } : {}),
                remarks: appendNote(cycle.remarks, dto.reason && dto.status !== CYCLE_STATUS.CANCELLED && dto.status !== CYCLE_STATUS.DELAYED ? `[${dto.status}] ${dto.reason}` : null)
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_cycle",
                entity_id: cycleId,
                action: AUDIT_ACTION.STATUS_CHANGE,
                performed_by: actingUserId,
                patient_id: planForContext?.patient_id,
                branch_id: planForContext?.branch_id,
                change_summary: summarizeStatusChange(current, dto.status, dto.reason)
            });

            if (dto.status === CYCLE_STATUS.COMPLETED) {

                const plan = await this.repository.findPlanForUpdate(tx, cycle.chemotherapy_plan_id);

                if (plan && !PLAN_TERMINAL_STATUSES.includes(plan.treatment_status as PlanStatus)) {

                    const completedCycles = (plan.completed_cycles ?? 0) + 1;
                    const allCyclesDone = completedCycles >= plan.planned_cycles;

                    await this.repository.updatePlan(tx, plan.chemotherapy_plan_id, {
                        completed_cycles: completedCycles,
                        ...(allCyclesDone ? { treatment_status: PLAN_STATUS.COMPLETED } : {})
                    });

                    if (allCyclesDone) {

                        await logAudit(tx, {
                            entity_type: "chemotherapy_plan",
                            entity_id: plan.chemotherapy_plan_id,
                            action: AUDIT_ACTION.STATUS_CHANGE,
                            performed_by: actingUserId,
                            patient_id: plan.patient_id,
                            branch_id: plan.branch_id,
                            change_summary: summarizeStatusChange(plan.treatment_status ?? PLAN_STATUS.ACTIVE, PLAN_STATUS.COMPLETED, "All planned cycles completed")
                        });

                    }

                }

            }

        });

        return this.getCycle(cycleId);

    }

    // ---------------------------------------------------------------
    // Administration - the only sub-record that mutates cycle/plan status
    // as a side effect (first drug of a cycle moves it to IN_PROGRESS,
    // first drug of a plan moves it to ACTIVE). Never editable/deletable
    // once recorded.
    // ---------------------------------------------------------------

    async recordAdministration(cycleId: string, dto: RecordAdministrationDto, actingUserId: string) {

        const cycle = await this.repository.findCycleForUpdate(prisma, cycleId);

        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }

        if (!CYCLE_ADMINISTRABLE_STATUSES.includes(cycle.cycle_status as CycleStatus)) {
            throw new Error(`Cannot record administration for a cycle in status ${cycle.cycle_status} - the cycle must be APPROVED or IN_PROGRESS`);
        }

        const planItem = await this.repository.findPlanItemById(dto.chemotherapy_plan_item_id);

        if (!planItem) {
            throw new Error("Plan item not found");
        }

        if (planItem.chemotherapy_plan_id !== cycle.chemotherapy_plan_id) {
            throw new Error("This drug does not belong to the plan this cycle is on");
        }

        const administrationId = await prisma.$transaction(async (tx) => {

            const newId = await this.repository.generateAdministrationId(tx);

            await this.repository.createAdministration(tx, {
                administration_id: newId,
                chemotherapy_cycle_id: cycleId,
                chemotherapy_plan_item_id: dto.chemotherapy_plan_item_id,
                administration_date: new Date(dto.administration_date),
                administration_start_time: dto.administration_start_time ? new Date(dto.administration_start_time) : null,
                administration_end_time: dto.administration_end_time ? new Date(dto.administration_end_time) : null,
                administered_dose: dto.administered_dose ?? null,
                administered_dose_unit: dto.administered_dose_unit ?? null,
                administration_route: dto.administration_route ?? null,
                infusion_rate: dto.infusion_rate ?? null,
                infusion_duration_minutes: dto.infusion_duration_minutes ?? null,
                infusion_completed: dto.infusion_completed ?? false,
                administered_by: dto.administered_by ?? null,
                verified_by: dto.verified_by ?? null,
                iv_site: dto.iv_site ?? null,
                iv_access_type: dto.iv_access_type ?? null,
                cannula_size: dto.cannula_size ?? null,
                peripheral_line: dto.peripheral_line ?? false,
                central_line: dto.central_line ?? false,
                picc_line: dto.picc_line ?? false,
                port_used: dto.port_used ?? false,
                pump_used: dto.pump_used ?? false,
                pump_serial_no: dto.pump_serial_no ?? null,
                oxygen_support: dto.oxygen_support ?? false,
                steroid_given: dto.steroid_given ?? false,
                antihistamine_given: dto.antihistamine_given ?? false,
                antiemetic_given: dto.antiemetic_given ?? false,
                hydration_given: dto.hydration_given ?? false,
                emergency_medication_given: dto.emergency_medication_given ?? false,
                treatment_stopped: dto.treatment_stopped ?? false,
                interruption_reason: dto.interruption_reason ?? null,
                doctor_informed: dto.doctor_informed ?? false,
                nursing_notes: dto.nursing_notes ?? null,
                administration_status: dto.administration_status ?? "Completed",
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });

            if (cycle.cycle_status === CYCLE_STATUS.APPROVED) {
                await this.repository.updateCycle(tx, cycleId, { cycle_status: CYCLE_STATUS.IN_PROGRESS });
            }

            const plan = await this.repository.findPlanForUpdate(tx, cycle.chemotherapy_plan_id);

            if (plan && plan.treatment_status === PLAN_STATUS.PLANNED) {
                await this.repository.updatePlan(tx, plan.chemotherapy_plan_id, { treatment_status: PLAN_STATUS.ACTIVE });
            }

            await logAudit(tx, {
                entity_type: "chemotherapy_administration",
                entity_id: newId,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: summarizeCreate({
                    chemotherapy_cycle_id: cycleId,
                    chemotherapy_plan_item_id: dto.chemotherapy_plan_item_id,
                    administered_dose: dto.administered_dose ?? null,
                    administered_dose_unit: dto.administered_dose_unit ?? null
                })
            });

            return newId;

        });

        return this.repository.listAdministrationsForCycle(cycleId).then(
            (rows) => rows.find((r) => r.administration_id === administrationId) ?? rows[rows.length - 1]
        );

    }

    async listAdministrations(cycleId: string) {

        await this.getCycle(cycleId);
        return this.repository.listAdministrationsForCycle(cycleId);

    }

    // ---------------------------------------------------------------
    // Vitals / adverse events / lab reviews / followups - append-only,
    // no cycle-status gating (they can legitimately be recorded before,
    // during, or after a cycle - e.g. a follow-up visit happens well after
    // the cycle that prompted it is COMPLETED).
    // ---------------------------------------------------------------

    // Looks up the owning plan's patient_id/branch_id for audit context -
    // lighter than this.getCycle() (which eagerly loads every nested
    // administration/vitals/adverse-event/etc array we don't need here).
    private async getCyclePlanContext(cycleId: string) {

        const cycle = await this.repository.findCycleForUpdate(prisma, cycleId);

        if (!cycle) {
            throw new Error("Chemotherapy cycle not found");
        }

        const plan = await this.repository.findPlanForUpdate(prisma, cycle.chemotherapy_plan_id);

        return { cycle, plan };

    }

    async recordVitals(cycleId: string, dto: RecordVitalsDto, actingUserId: string) {

        const { plan } = await this.getCyclePlanContext(cycleId);

        return prisma.$transaction(async (tx) => {

            const id = await this.repository.generateVitalsId(tx);

            const created = await this.repository.createVitals(tx, {
                vital_id: id,
                chemotherapy_cycle_id: cycleId,
                vital_stage: dto.vital_stage ?? null,
                blood_pressure_systolic: dto.blood_pressure_systolic ?? null,
                blood_pressure_diastolic: dto.blood_pressure_diastolic ?? null,
                pulse_rate: dto.pulse_rate ?? null,
                respiratory_rate: dto.respiratory_rate ?? null,
                body_temperature: dto.body_temperature ?? null,
                spo2: dto.spo2 ?? null,
                height: dto.height ?? null,
                weight: dto.weight ?? null,
                body_surface_area: dto.body_surface_area ?? null,
                bmi: dto.bmi ?? null,
                pain_score: dto.pain_score ?? null,
                pain_location: dto.pain_location ?? null,
                blood_sugar: dto.blood_sugar ?? null,
                oxygen_support: dto.oxygen_support ?? false,
                oxygen_flow_rate: dto.oxygen_flow_rate ?? null,
                consciousness_level: dto.consciousness_level ?? null,
                hydration_status: dto.hydration_status ?? null,
                // recorded_by FKs to employees.employee_id, not user_table.user_id -
                // actingUserId (the JWT subject) is the wrong ID space, so this is
                // left null unless the caller names a real employee_id.
                recorded_by: dto.recorded_by ?? null,
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_vitals",
                entity_id: id,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: summarizeCreate({ chemotherapy_cycle_id: cycleId, vital_stage: dto.vital_stage ?? null })
            });

            return created;

        });

    }

    async listVitals(cycleId: string) {
        await this.getCycle(cycleId);
        return this.repository.listVitalsForCycle(cycleId);
    }

    async recordAdverseEvent(cycleId: string, dto: RecordAdverseEventDto, actingUserId: string) {

        const { plan } = await this.getCyclePlanContext(cycleId);

        if (!dto.adverse_event_name?.trim()) {
            throw new Error("adverse_event_name is required");
        }

        return prisma.$transaction(async (tx) => {

            const id = await this.repository.generateAdverseEventId(tx);

            const created = await this.repository.createAdverseEvent(tx, {
                adverse_event_id: id,
                chemotherapy_cycle_id: cycleId,
                event_date: dto.event_date ? new Date(dto.event_date) : new Date(),
                adverse_event_name: dto.adverse_event_name,
                adverse_event_category: dto.adverse_event_category ?? null,
                nausea: dto.nausea ?? false,
                vomiting: dto.vomiting ?? false,
                diarrhea: dto.diarrhea ?? false,
                constipation: dto.constipation ?? false,
                mucositis: dto.mucositis ?? false,
                fever: dto.fever ?? false,
                fatigue: dto.fatigue ?? false,
                neuropathy: dto.neuropathy ?? false,
                alopecia: dto.alopecia ?? false,
                skin_rash: dto.skin_rash ?? false,
                anemia: dto.anemia ?? false,
                neutropenia: dto.neutropenia ?? false,
                thrombocytopenia: dto.thrombocytopenia ?? false,
                infection: dto.infection ?? false,
                bleeding: dto.bleeding ?? false,
                pain: dto.pain ?? false,
                reaction_grade: dto.reaction_grade ?? null,
                ctcae_grade: dto.ctcae_grade ?? null,
                severity: dto.severity ?? null,
                reaction_description: dto.reaction_description ?? null,
                treatment_interrupted: dto.treatment_interrupted ?? false,
                treatment_stopped: dto.treatment_stopped ?? false,
                hospitalization_required: dto.hospitalization_required ?? false,
                icu_required: dto.icu_required ?? false,
                emergency_medication_given: dto.emergency_medication_given ?? false,
                medication_given: dto.medication_given ?? null,
                dose_modified: dto.dose_modified ?? false,
                dose_reduced: dto.dose_reduced ?? false,
                reduction_percentage: dto.reduction_percentage ?? null,
                dose_delayed: dto.dose_delayed ?? false,
                delay_days: dto.delay_days ?? null,
                doctor_action: dto.doctor_action ?? null,
                nursing_action: dto.nursing_action ?? null,
                physician_id: dto.physician_id ?? null,
                // reported_by FKs to employees.employee_id - see recordVitals' note.
                reported_by: dto.reported_by ?? null,
                resolved: dto.resolved ?? false,
                resolution_date: dto.resolution_date ? new Date(dto.resolution_date) : null,
                remarks: dto.remarks ?? null,
                created_by: actingUserId
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_adverse_event",
                entity_id: id,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: summarizeCreate({ chemotherapy_cycle_id: cycleId, adverse_event_name: dto.adverse_event_name, ctcae_grade: dto.ctcae_grade ?? null })
            });

            return created;

        });

    }

    async listAdverseEvents(cycleId: string) {
        await this.getCycle(cycleId);
        return this.repository.listAdverseEventsForCycle(cycleId);
    }

    async recordLabReview(cycleId: string, dto: RecordLabReviewDto, actingUserId: string) {

        const { plan } = await this.getCyclePlanContext(cycleId);

        return prisma.$transaction(async (tx) => {

            const id = await this.repository.generateLabReviewId(tx);

            const created = await this.repository.createLabReview(tx, {
                lab_review_id: id,
                chemotherapy_cycle_id: cycleId,
                hemoglobin: dto.hemoglobin ?? null,
                rbc: dto.rbc ?? null,
                wbc: dto.wbc ?? null,
                platelet_count: dto.platelet_count ?? null,
                neutrophil_count: dto.neutrophil_count ?? null,
                anc: dto.anc ?? null,
                creatinine: dto.creatinine ?? null,
                creatinine_clearance: dto.creatinine_clearance ?? null,
                blood_urea: dto.blood_urea ?? null,
                sgot_ast: dto.sgot_ast ?? null,
                sgpt_alt: dto.sgpt_alt ?? null,
                bilirubin: dto.bilirubin ?? null,
                alkaline_phosphatase: dto.alkaline_phosphatase ?? null,
                albumin: dto.albumin ?? null,
                sodium: dto.sodium ?? null,
                potassium: dto.potassium ?? null,
                calcium: dto.calcium ?? null,
                magnesium: dto.magnesium ?? null,
                chloride: dto.chloride ?? null,
                phosphorus: dto.phosphorus ?? null,
                uric_acid: dto.uric_acid ?? null,
                coagulation_profile: dto.coagulation_profile ?? null,
                urine_test_result: dto.urine_test_result ?? null,
                pregnancy_test: dto.pregnancy_test ?? null,
                cbc_normal: dto.cbc_normal ?? true,
                renal_function_ok: dto.renal_function_ok ?? true,
                liver_function_ok: dto.liver_function_ok ?? true,
                chemotherapy_fit: dto.chemotherapy_fit ?? true,
                // reviewed_by FKs to employees.employee_id - see recordVitals' note.
                reviewed_by: dto.reviewed_by ?? null,
                review_notes: dto.review_notes ?? null,
                created_by: actingUserId
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_lab_review",
                entity_id: id,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: summarizeCreate({ chemotherapy_cycle_id: cycleId, chemotherapy_fit: dto.chemotherapy_fit ?? true })
            });

            return created;

        });

    }

    async listLabReviews(cycleId: string) {
        await this.getCycle(cycleId);
        return this.repository.listLabReviewsForCycle(cycleId);
    }

    async recordFollowup(cycleId: string, dto: RecordFollowupDto, actingUserId: string) {

        const { plan } = await this.getCyclePlanContext(cycleId);

        if (!dto.followup_date) {
            throw new Error("followup_date is required");
        }

        return prisma.$transaction(async (tx) => {

            const id = await this.repository.generateFollowupId(tx);

            const created = await this.repository.createFollowup(tx, {
                followup_id: id,
                chemotherapy_cycle_id: cycleId,
                followup_date: new Date(dto.followup_date),
                next_followup_date: dto.next_followup_date ? new Date(dto.next_followup_date) : null,
                treatment_response: dto.treatment_response ?? null,
                recist_response: dto.recist_response ?? null,
                disease_progression: dto.disease_progression ?? false,
                progression_date: dto.progression_date ? new Date(dto.progression_date) : null,
                progression_details: dto.progression_details ?? null,
                remission_status: dto.remission_status ?? null,
                recurrence: dto.recurrence ?? false,
                recurrence_date: dto.recurrence_date ? new Date(dto.recurrence_date) : null,
                recurrence_site: dto.recurrence_site ?? null,
                metastasis: dto.metastasis ?? false,
                metastasis_site: dto.metastasis_site ?? null,
                survival_status: dto.survival_status ?? null,
                performance_status: dto.performance_status ?? null,
                ongoing_symptoms: dto.ongoing_symptoms ?? null,
                late_toxicity: dto.late_toxicity ?? null,
                supportive_care: dto.supportive_care ?? null,
                followup_notes: dto.followup_notes ?? null,
                physician_assessment: dto.physician_assessment ?? null,
                physician_id: dto.physician_id ?? null,
                created_by: actingUserId
            });

            await logAudit(tx, {
                entity_type: "chemotherapy_followup",
                entity_id: id,
                action: AUDIT_ACTION.CREATE,
                performed_by: actingUserId,
                patient_id: plan?.patient_id,
                branch_id: plan?.branch_id,
                change_summary: summarizeCreate({ chemotherapy_cycle_id: cycleId, treatment_response: dto.treatment_response ?? null, recist_response: dto.recist_response ?? null })
            });

            return created;

        });

    }

    async listFollowups(cycleId: string) {
        await this.getCycle(cycleId);
        return this.repository.listFollowupsForCycle(cycleId);
    }

    async listSupportiveMedicines() {
        return this.repository.listSupportiveMedicines();
    }

}
