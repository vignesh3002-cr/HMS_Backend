import { Prisma } from "@prisma/client";
import prisma from "../../../config/prisma";
import { generateId } from "../../../utils/idGenerator";
import { logAudit } from "../../audit/audit.service";
import { AUDIT_ACTION } from "../../audit/audit.types";
import {
    axesForContext,
    categoriesForContext,
    deriveStage,
    displayCodeFor,
    resolveMode,
    rulesForContext,
} from "./engine";
import { buildConditionValues, coerceConditionValue } from "./conditions";
import {
    CONTEXT_LABEL,
    CONTEXT_PREFIX,
    CONTEXT_VALUES,
    type ConditionGroup,
    type DirectStageRow,
    type StageAxis,
    type StageCategoryRow,
    type StageContext,
    type StageRuleRow,
    type StagingCriterionRow,
} from "./types";

// ---------------------------------------------------------------------------
// Master data is read-only between seeds, so each schema is cached in memory
// for a few minutes instead of being re-read on every keystroke. The card
// previews derivations through POST /derive, so this stays hot.
// ---------------------------------------------------------------------------

const MASTER_TTL_MS = 5 * 60 * 1000;

type MasterBundle = {
    schema: {
        schema_id: string;
        schema_name: string;
        system: string | null;
        edition: string | null;
        mode: string;
        extra_inputs: string | null;
        note: string | null;
    };
    categories: StageCategoryRow[];
    rules: StageRuleRow[];
    directStages: DirectStageRow[];
    criteria: StagingCriterionRow[];
};

const masterCache = new Map<string, { at: number; bundle: MasterBundle }>();

/** Called after re-seeding the master tables. */
export function clearStagingMasterCache() {
    masterCache.clear();
}

async function loadMaster(schemaId: string): Promise<MasterBundle> {
    const cached = masterCache.get(schemaId);
    if (cached && Date.now() - cached.at < MASTER_TTL_MS) {
        return cached.bundle;
    }

    const schema = await prisma.staging_schema.findUnique({
        where: { schema_id: schemaId },
    });

    if (!schema || !schema.is_active) {
        throw new Error(`Staging schema ${schemaId} not found`);
    }

    const [categories, rules, directStages, criteria] = await Promise.all([
        prisma.staging_category.findMany({ where: { schema_id: schemaId } }),
        prisma.stage_rule.findMany({ where: { schema_id: schemaId } }),
        prisma.direct_stage.findMany({
            where: { schema_id: schemaId },
            orderBy: [{ display_order: "asc" }, { stage_code: "asc" }],
        }),
        prisma.staging_criterion.findMany({ orderBy: { display_order: "asc" } }),
    ]);

    const bundle: MasterBundle = {
        schema: {
            schema_id: schema.schema_id,
            schema_name: schema.schema_name,
            system: schema.system,
            edition: schema.edition,
            mode: schema.mode,
            extra_inputs: schema.extra_inputs,
            note: schema.note,
        },
        categories: categories as unknown as StageCategoryRow[],
        rules: rules.map((rule) => ({
            ...rule,
            conditions: (rule.conditions ?? []) as unknown as ConditionGroup[],
        })) as unknown as StageRuleRow[],
        directStages: directStages as unknown as DirectStageRow[],
        criteria: criteria as unknown as StagingCriterionRow[],
    };

    masterCache.set(schemaId, { at: Date.now(), bundle });
    return bundle;
}

const contextFamilyLabel = (context: StageContext) => CONTEXT_LABEL[context];

/**
 * The legacy clinical_stage column holds a sentence ("Stage IIB",
 * "Stage 0 (NMIBC)", "Very Low Risk"), while a derived group is just the
 * group ("IIB"). Add the word the mirrors and printouts expect.
 */
const legacyStageText = (stage: string) =>
    /^(stage|figo)\b/i.test(stage) || /risk/i.test(stage)
        ? stage
        : `Stage ${stage}`;

/** The contexts a schema can record, with the mode each one uses. */
function schemaContexts(bundle: MasterBundle) {
    return CONTEXT_VALUES.map((context) => ({
        context,
        label: contextFamilyLabel(context),
        prefix: CONTEXT_PREFIX[context],
        mode: resolveMode(bundle.rules, bundle.directStages, context),
    })).filter((entry) => entry.mode !== "NONE");
}

/** Extra criteria a schema's rules need, in the order the card should ask. */
function conditionsForContext(bundle: MasterBundle, context: StageContext) {
    const keys = new Set<string>();
    for (const rule of rulesForContext(bundle.rules, context)) {
        for (const group of rule.conditions) keys.add(group.key);
    }

    return bundle.criteria
        .filter((criterion) => keys.has(criterion.criterion_key))
        .map((criterion) => ({
            ...criterion,
            // S is rendered as a fourth axis, not as an extra input.
            rendered_as: criterion.criterion_key === "S" ? "axis" : "input",
        }));
}

/**
 * Accept either the code the clinician saw (cN1 / pT2) or the rule code
 * (N1 / T2) and return the rule code the engine matches on.
 */
function resolveCategory(
    categories: StageCategoryRow[],
    axis: StageAxis,
    value: string | null | undefined,
    context: StageContext
): { code: string | null; provided: boolean; found: boolean } {
    if (!value) return { code: null, provided: false, found: true };

    const familyCategories = categoriesForContext(categories, context).filter(
        (category) => category.axis === axis
    );
    const text = String(value).trim().toLowerCase();

    const exact =
        familyCategories.find((category) => category.rule_code.toLowerCase() === text) ??
        familyCategories.find((category) => category.shown_code.toLowerCase() === text);

    if (exact) return { code: exact.rule_code, provided: true, found: true };

    // Accept a code typed with a context prefix the schema itself does not
    // publish (cT2 for a schema whose T column is unprefixed).
    const stripped = String(value).trim().replace(/^(yc|yp|[cpr])(?=[TNM])/i, "").toLowerCase();
    const unprefixed =
        familyCategories.find((category) => category.rule_code.toLowerCase() === stripped) ??
        familyCategories.find((category) => category.shown_code.toLowerCase() === stripped);

    return {
        code: unprefixed?.rule_code ?? String(value).trim(),
        provided: true,
        found: Boolean(unprefixed),
    };
}

// ---------------------------------------------------------------------------
// Cancer type -> schema list
// ---------------------------------------------------------------------------

type Suggestion = { schema_id: string; reason: string } | null;

async function latestBiomarkers(patientId?: string) {
    if (!patientId) return null;

    const row = await prisma.ihc_results.findFirst({
        where: {
            oncology_staging_detail: { patient_id: patientId },
            OR: [
                { p16_status: { not: null } },
                { p40_status: { not: null } },
            ],
        },
        orderBy: { updated_at: "desc" },
        select: {
            p16_status: true,
            p40_status: true,
            updated_at: true,
            staging_detail_id: true,
        },
    });

    return row ?? null;
}

async function suggestSchema(
    rows: { schema_id: string; schema_name: string | null; auto_select_rule: string | null }[],
    patientId?: string
): Promise<Suggestion> {
    const biomarker = await latestBiomarkers(patientId);
    if (!biomarker) return null;

    const p16 = (biomarker.p16_status ?? "").toLowerCase();
    const p40 = (biomarker.p40_status ?? "").toLowerCase();

    for (const row of rows) {
        const rule = (row.auto_select_rule ?? "").toLowerCase();
        const name = (row.schema_name ?? "").toLowerCase();
        const seenOn = biomarker.updated_at
            ? new Date(biomarker.updated_at).toLocaleDateString("en-GB")
            : "the latest IHC";

        if (rule.includes("p16") && p16) {
            if (p16.startsWith("pos") && name.includes("p16-positive")) {
                return { schema_id: row.schema_id, reason: `p16 positive on IHC ${seenOn}` };
            }
            if (
                (p16.startsWith("neg") || p16.startsWith("not")) &&
                name.includes("p16-negative")
            ) {
                return { schema_id: row.schema_id, reason: `p16 ${p16} on IHC ${seenOn}` };
            }
        }

        if (rule.includes("p40") && p40) {
            if (p40.startsWith("pos") && name.includes("squamous")) {
                return { schema_id: row.schema_id, reason: `p40 positive on IHC ${seenOn}` };
            }
            if (p40.startsWith("neg") && name.includes("adenocarcinoma")) {
                return { schema_id: row.schema_id, reason: `p40 negative on IHC ${seenOn}` };
            }
        }
    }

    return null;
}

export class StagingService {

    async listSchemasForCancerType(cancerTypeId: string, patientId?: string) {
        const cancerType = await prisma.cancer_types.findUnique({
            where: { cancer_type_id: cancerTypeId },
            select: { cancer_type_id: true, cancer_type: true },
        });

        if (!cancerType) {
            throw new Error("Cancer type not found");
        }

        const mapRows = await prisma.staging_map.findMany({
            where: { cancer_type_id: cancerTypeId },
            orderBy: [{ display_order: "asc" }, { schema_id: "asc" }],
        });

        const bundles = await Promise.all(
            [...new Set(mapRows.map((row) => row.schema_id))].map(loadMaster)
        );
        const byId = new Map(bundles.map((bundle) => [bundle.schema.schema_id, bundle]));

        const suggestion = await suggestSchema(mapRows, patientId);

        const subsiteQuestion =
            mapRows.find((row) => row.subsite_question)?.subsite_question ?? null;

        const schemas = mapRows.map((row) => {
            const bundle = byId.get(row.schema_id)!;
            const contexts = schemaContexts(bundle);

            return {
                schema_id: row.schema_id,
                schema_name: row.schema_name ?? bundle.schema.schema_name,
                role: row.role,
                system: bundle.schema.system,
                edition: bundle.schema.edition,
                system_edition: row.system_edition,
                mode: bundle.schema.mode,
                display_order: row.display_order,
                subsite_question: row.subsite_question,
                auto_select_rule: row.auto_select_rule,
                note: row.note,
                suggested: suggestion?.schema_id === row.schema_id,
                suggestion_reason:
                    suggestion && suggestion.schema_id === row.schema_id ? suggestion.reason : null,
                contexts,
                requires_conditions: conditionsForContext(bundle, "CLINICAL")
                    .filter((criterion) => criterion.rendered_as === "input")
                    .map((criterion) => criterion.criterion_key),
                direct_stages: bundle.directStages.length,
            };
        });

        return {
            cancer_type_id: cancerType.cancer_type_id,
            cancer_type: cancerType.cancer_type,
            subsite_question: subsiteQuestion,
            default_schema_id:
                schemas.find((schema) => schema.role === "PRIMARY")?.schema_id ??
                schemas[0]?.schema_id ??
                null,
            suggested_schema_id: suggestion?.schema_id ?? null,
            schemas,
        };
    }

    async getSchemaDetail(schemaId: string, context: StageContext) {
        const bundle = await loadMaster(schemaId);
        const mode = resolveMode(bundle.rules, bundle.directStages, context);

        const groups: Record<string, { code: string; rule_code: string; definition: string | null }[]> = {};
        for (const category of categoriesForContext(bundle.categories, context)) {
            (groups[category.axis] ??= []).push({
                code: category.shown_code,
                rule_code: category.rule_code,
                definition: category.definition,
            });
        }

        const contexts = schemaContexts(bundle);

        return {
            schema: {
                ...bundle.schema,
                role: null as string | null,
            },
            context,
            context_label: contextFamilyLabel(context),
            context_prefix: CONTEXT_PREFIX[context],
            contexts,
            mode,
            axes: axesForContext(bundle.categories, context),
            categories: groups,
            extra_inputs: conditionsForContext(bundle, context),
            direct_stages: bundle.directStages,
            stage_groups: [
                ...new Set(
                    rulesForContext(bundle.rules, context)
                        .map((rule) => rule.stage_group)
                        .filter(Boolean)
                ),
            ],
            requires_conditions: conditionsForContext(bundle, context)
                .filter((criterion) => criterion.rendered_as === "input")
                .map((criterion) => criterion.criterion_key),
            notes: bundle.schema.note,
        };
    }

    // -----------------------------------------------------------------------
    // Derivation (also used by the save path, so the screen can never store a
    // stage the engine disagrees with).
    // -----------------------------------------------------------------------

    private async deriveFor(
        schemaId: string,
        context: StageContext,
        selection: {
            t?: string | null;
            n?: string | null;
            m?: string | null;
            s?: string | null;
            conditions?: Record<string, string | number | null | undefined>;
        }
    ) {
        const bundle = await loadMaster(schemaId);

        const resolvedT = resolveCategory(bundle.categories, "T", selection.t, context);
        const resolvedN = resolveCategory(bundle.categories, "N", selection.n, context);
        const resolvedM = resolveCategory(bundle.categories, "M", selection.m, context);
        const resolvedS = resolveCategory(bundle.categories, "S", selection.s, context);

        const t = resolvedT.code;
        const n = resolvedN.code;
        const m = resolvedM.code;
        const s = resolvedS.code;

        const invalidCodes = (
            [
                ["T", resolvedT],
                ["N", resolvedN],
                ["M", resolvedM],
                ["S", resolvedS],
            ] as const
        )
            .filter(([, resolved]) => resolved.provided && !resolved.found)
            .map(([axis]) => axis);

        const conditions = buildConditionValues(selection.conditions, bundle.criteria);
        if (s) conditions.S = s;

        const result = deriveStage({
            context,
            categories: bundle.categories,
            rules: bundle.rules,
            directStages: bundle.directStages,
            t,
            n,
            m,
            s,
            conditions,
        });

        const matchedRule = result.rule_id
            ? bundle.rules.find((rule) => rule.rule_id === result.rule_id)
            : undefined;

        return {
            ...result,
            schema_id: schemaId,
            schema_name: bundle.schema.schema_name,
            system: bundle.schema.system,
            edition: bundle.schema.edition,
            context,
            t_code: t,
            n_code: n,
            m_code: m,
            s_code: s,
            t_display: displayCodeFor(bundle.categories, "T", t, context),
            n_display: displayCodeFor(bundle.categories, "N", n, context),
            m_display: displayCodeFor(bundle.categories, "M", m, context),
            s_display: displayCodeFor(bundle.categories, "S", s, context),
            conditions,
            invalid_codes: invalidCodes,
            matched_rule: matchedRule
                ? {
                    rule_id: matchedRule.rule_id,
                    stage_group: matchedRule.stage_group,
                    criteria_text: matchedRule.criteria_text,
                    t_codes: matchedRule.t_codes,
                    n_codes: matchedRule.n_codes,
                    m_codes: matchedRule.m_codes,
                }
                : null,
            direct_stages: bundle.directStages,
        };
    }

    async derive(dto: {
        schema_id: string;
        context: StageContext;
        t?: string | null;
        n?: string | null;
        m?: string | null;
        s?: string | null;
        conditions?: Record<string, string | number | null | undefined>;
    }) {
        if (!CONTEXT_VALUES.includes(dto.context)) {
            throw new Error(`Unknown staging context ${dto.context}`);
        }
        return this.deriveFor(dto.schema_id, dto.context, dto);
    }

    // -----------------------------------------------------------------------
    // Stage records
    // -----------------------------------------------------------------------

    async listRecords(stagingDetailId: string) {
        const detail = await prisma.oncology_staging_detail.findUnique({
            where: { staging_detail_id: stagingDetailId },
            select: {
                staging_detail_id: true,
                patient_id: true,
                diagnosis_id: true,
                cancer_type_id: true,
                diagnosis_date: true,
            },
        });

        if (!detail) {
            throw new Error("Staging detail not found");
        }

        const records = await prisma.oncology_stage_record.findMany({
            where: { staging_detail_id: stagingDetailId, is_active: true },
            orderBy: [{ schema_role: "asc" }, { created_at: "asc" }],
        });

        return {
            ...detail,
            records,
            alerts: await this.stageAlerts(detail.patient_id, records),
        };
    }

    /**
     * Spec §4: if p16 (or p40) changes on a later IHC report, the saved stage
     * gets a banner asking for the schema to be reviewed.
     */
    private async stageAlerts(
        patientId: string,
        records: { schema_id: string; context: string }[]
    ) {
        if (records.length === 0) return [];

        const biomarker = await latestBiomarkers(patientId);
        if (!biomarker) return [];

        const p16 = (biomarker.p16_status ?? "").toLowerCase();
        const p40 = (biomarker.p40_status ?? "").toLowerCase();
        const seenOn = biomarker.updated_at
            ? new Date(biomarker.updated_at).toLocaleDateString("en-GB")
            : "the latest IHC";

        const alerts: { type: string; severity: string; message: string; schema_id: string }[] = [];

        if (p16.startsWith("neg") && records.some((row) => row.schema_id === "S04")) {
            alerts.push({
                type: "P16_CHANGED",
                severity: "WARNING",
                schema_id: "S04",
                message: `p16 is now negative (IHC ${seenOn}). This stage was recorded with the HPV-associated oropharynx schema - review the staging schema.`,
            });
        }

        if (p16.startsWith("pos") && records.some((row) => row.schema_id === "S02")) {
            alerts.push({
                type: "P16_CHANGED",
                severity: "WARNING",
                schema_id: "S02",
                message: `p16 is now positive (IHC ${seenOn}). This stage was recorded with the p16-negative oropharynx schema - review the staging schema.`,
            });
        }

        if (p40.startsWith("neg") && records.some((row) => row.schema_id === "S14")) {
            alerts.push({
                type: "P40_CHANGED",
                severity: "WARNING",
                schema_id: "S14",
                message: `p40 is now negative (IHC ${seenOn}). This stage was recorded with the oesophageal SCC schema - review the staging schema.`,
            });
        }

        if (p40.startsWith("pos") && records.some((row) => row.schema_id === "S15")) {
            alerts.push({
                type: "P40_CHANGED",
                severity: "WARNING",
                schema_id: "S15",
                message: `p40 is now positive (IHC ${seenOn}). This stage was recorded with the oesophageal adenocarcinoma schema - review the staging schema.`,
            });
        }

        return alerts;
    }

    async history(patientId: string, cancerTypeId?: string) {
        return prisma.oncology_stage_record.findMany({
            where: {
                patient_id: patientId,
                ...(cancerTypeId ? { cancer_type_id: cancerTypeId } : {}),
            },
            orderBy: [{ stage_date: "desc" }, { created_at: "desc" }],
            take: 200,
        });
    }

    private async resolveRole(cancerTypeId: string, schemaId: string) {
        const row = await prisma.staging_map.findFirst({
            where: { cancer_type_id: cancerTypeId, schema_id: schemaId },
            orderBy: { display_order: "asc" },
        });
        return row?.role ?? "ADDITIONAL";
    }

    /**
     * Saves the complete set of stage records for one visit. The screen sends
     * every block it is showing; anything missing from the payload is
     * deactivated (history is kept), which also covers a cancer type change.
     */
    async saveRecords(
        dto: {
            staging_detail_id: string;
            replace?: boolean;
            records: {
                cancer_type_id?: string | null;
                schema_id: string;
                context: StageContext;
                t?: string | null;
                n?: string | null;
                m?: string | null;
                s?: string | null;
                conditions?: Record<string, string | number | null | undefined>;
                modifiers?: Record<string, unknown>;
                final_stage?: string | null;
                is_overridden?: boolean;
                override_reason?: string | null;
                stage_date?: string | null;
                notes?: string | null;
            }[];
        },
        actingUserId: string
    ) {
        const detail = await prisma.oncology_staging_detail.findUnique({
            where: { staging_detail_id: dto.staging_detail_id },
            select: {
                staging_detail_id: true,
                patient_id: true,
                diagnosis_id: true,
                cancer_type_id: true,
                branch_id: true,
                diagnosis_date: true,
            },
        });

        if (!detail) {
            throw new Error("Staging detail not found");
        }

        const cancerTypeId = detail.cancer_type_id ?? "";
        const mappedSchemas = new Set(
            (
                await prisma.staging_map.findMany({
                    where: { cancer_type_id: cancerTypeId },
                    select: { schema_id: true },
                })
            ).map((row) => row.schema_id)
        );

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const prepared = [] as {
            record: (typeof dto.records)[number];
            cancerTypeId: string;
            role: string;
            derived: Awaited<ReturnType<StagingService["deriveFor"]>>;
            finalStage: string;
            stageDate: Date;
        }[];

        for (const record of dto.records) {
            const recordTypeId = record.cancer_type_id || cancerTypeId;

            if (recordTypeId === cancerTypeId) {
                if (!mappedSchemas.has(record.schema_id)) {
                    throw new Error(
                        `Schema ${record.schema_id} does not apply to this cancer type`
                    );
                }
            } else {
                const valid = await prisma.staging_map.count({
                    where: {
                        cancer_type_id: recordTypeId,
                        schema_id: record.schema_id,
                    },
                });
                if (valid === 0) {
                    throw new Error(
                        `Schema ${record.schema_id} does not apply to cancer type ${recordTypeId}`
                    );
                }
            }

            if (!CONTEXT_VALUES.includes(record.context)) {
                throw new Error(`Unknown staging context ${record.context}`);
            }

            const derived = await this.deriveFor(record.schema_id, record.context, record);
            const override = Boolean(record.is_overridden);

            if (derived.mode === "TNM" && derived.invalid_codes.length > 0) {
                throw new Error(
                    `${derived.invalid_codes.join(", ")} code is not part of this staging schema in the ${record.context.toLowerCase()} context`
                );
            }

            if (override) {
                const reason = (record.override_reason ?? "").trim();
                if (reason.length < 10) {
                    throw new Error(
                        "An override needs a reason of at least 10 characters"
                    );
                }
                if (!record.final_stage) {
                    throw new Error("Choose the stage being overridden with");
                }
                if (derived.derived_stage && record.final_stage === derived.derived_stage) {
                    throw new Error(
                        "The override stage is the same as the calculated stage - remove the override instead"
                    );
                }
            }

            let finalStage: string | null;

            if (derived.mode === "DIRECT") {
                if (!record.final_stage) {
                    throw new Error("Select a stage");
                }
                const allowed = derived.direct_stages.some(
                    (stage) => stage.stage_code === record.final_stage
                );
                if (!allowed) {
                    throw new Error(
                        `Stage ${record.final_stage} is not part of this staging system`
                    );
                }
                finalStage = record.final_stage;
            } else if (override) {
                finalStage = record.final_stage ?? null;
            } else {
                if (derived.status === "INCOMPLETE") {
                    const missing = derived.missing_conditions.length
                        ? ` (${derived.missing_conditions.join(", ")} required)`
                        : "";
                    throw new Error(
                        derived.explanation ?? `The stage cannot be calculated yet${missing}`
                    );
                }
                if (derived.status === "NO_MATCH") {
                    throw new Error(
                        derived.explanation ??
                        "The stage cannot be calculated from these values - record it as an override with a reason"
                    );
                }
                finalStage = derived.derived_stage;
            }

            if (!finalStage) {
                throw new Error("The final stage is required");
            }

            const stageDate = record.stage_date ? new Date(record.stage_date) : new Date();
            if (Number.isNaN(stageDate.getTime())) {
                throw new Error("The stage date is not a valid date");
            }
            if (stageDate.getTime() > today.getTime()) {
                throw new Error("The stage date cannot be in the future");
            }
            if (
                detail.diagnosis_date &&
                stageDate.getTime() < new Date(detail.diagnosis_date).getTime()
            ) {
                throw new Error("The stage date cannot be before the diagnosis date");
            }

            prepared.push({
                record,
                cancerTypeId: recordTypeId,
                role: await this.resolveRole(recordTypeId, record.schema_id),
                derived,
                finalStage,
                stageDate: new Date(
                    Date.UTC(
                        stageDate.getFullYear(),
                        stageDate.getMonth(),
                        stageDate.getDate()
                    )
                ),
            });
        }

        const keep = new Set(
            prepared.map(
                (entry) =>
                    `${entry.cancerTypeId}|${entry.record.schema_id}|${entry.record.context}`
            )
        );

        await prisma.$transaction(async (tx) => {
            // One active stage per context *within a cancer type*: a record
            // saved under a different schema for the same context (sub-site
            // changed) moves to history instead of lingering beside the new
            // one. A stage for another selected cancer type is untouched.
            for (const entry of prepared) {
                const conflicting = await tx.oncology_stage_record.findMany({
                    where: {
                        staging_detail_id: dto.staging_detail_id,
                        cancer_type_id: entry.cancerTypeId,
                        context: entry.record.context,
                        is_active: true,
                        schema_id: { not: entry.record.schema_id },
                    },
                });

                for (const row of conflicting) {
                    await tx.oncology_stage_record.update({
                        where: { id: row.id },
                        data: {
                            is_active: false,
                            updated_by: actingUserId,
                            updated_at: new Date(),
                            notes: [row.notes, "Cancer type / staging schema changed"]
                                .filter(Boolean)
                                .join(" · "),
                        },
                    });

                    await logAudit(tx, {
                        entity_type: "oncology_stage_record",
                        entity_id: row.stage_record_id,
                        action: AUDIT_ACTION.DEACTIVATE,
                        performed_by: actingUserId,
                        patient_id: row.patient_id,
                        branch_id: detail.branch_id,
                        change_summary: `Superseded by ${entry.record.schema_id} (${entry.record.context})`,
                    });
                }
            }

            // Drop anything the card no longer shows.
            if (dto.replace !== false) {
                const active = await tx.oncology_stage_record.findMany({
                    where: {
                        staging_detail_id: dto.staging_detail_id,
                        is_active: true,
                    },
                });

                for (const row of active) {
                    if (keep.has(`${row.schema_id}|${row.context}`)) continue;

                    await tx.oncology_stage_record.update({
                        where: { id: row.id },
                        data: {
                            is_active: false,
                            updated_by: actingUserId,
                            updated_at: new Date(),
                            notes: [row.notes, "Removed from the staging card"]
                                .filter(Boolean)
                                .join(" · "),
                        },
                    });

                    await logAudit(tx, {
                        entity_type: "oncology_stage_record",
                        entity_id: row.stage_record_id,
                        action: AUDIT_ACTION.DEACTIVATE,
                        performed_by: actingUserId,
                        patient_id: row.patient_id,
                        branch_id: detail.branch_id,
                        change_summary: "Removed from the staging card",
                    });
                }
            }

            for (const entry of prepared) {
                const {
                    record,
                    cancerTypeId: recordTypeId,
                    role,
                    derived,
                    finalStage,
                    stageDate,
                } = entry;

                const existing = await tx.oncology_stage_record.findFirst({
                    where: {
                        staging_detail_id: dto.staging_detail_id,
                        cancer_type_id: recordTypeId,
                        schema_id: record.schema_id,
                        context: record.context,
                        is_active: true,
                    },
                });

                const payload = {
                    diagnosis_id: detail.diagnosis_id,
                    patient_id: detail.patient_id,
                    cancer_type_id: recordTypeId,
                    schema_id: record.schema_id,
                    schema_role: role,
                    system: derived.system,
                    edition: derived.edition,
                    context: record.context,
                    mode: derived.mode,
                    t_code: derived.t_code,
                    n_code: derived.n_code,
                    m_code: derived.m_code,
                    s_code: derived.s_code,
                    t_display: derived.t_display,
                    n_display: derived.n_display,
                    m_display: derived.m_display,
                    conditions: (record.conditions ?? {}) as Prisma.InputJsonValue,
                    modifiers: (record.modifiers ?? {}) as Prisma.InputJsonValue,
                    derived_stage: derived.derived_stage,
                    derived_rule_id: derived.rule_id,
                    final_stage: finalStage,
                    is_overridden: Boolean(record.is_overridden),
                    override_reason: record.override_reason?.trim() || null,
                    stage_date: stageDate,
                    notes: record.notes?.trim() || null,
                    updated_by: actingUserId,
                    updated_at: new Date(),
                };

                if (existing) {
                    await tx.oncology_stage_record.update({
                        where: { id: existing.id },
                        data: payload,
                    });

                    await logAudit(tx, {
                        entity_type: "oncology_stage_record",
                        entity_id: existing.stage_record_id,
                        action: AUDIT_ACTION.UPDATE,
                        performed_by: actingUserId,
                        patient_id: detail.patient_id,
                        branch_id: detail.branch_id,
                        change_summary: JSON.stringify({
                            schema_id: record.schema_id,
                            context: record.context,
                            derived_stage: derived.derived_stage,
                            final_stage: finalStage,
                            is_overridden: Boolean(record.is_overridden),
                        }),
                    });
                } else {
                    const stageRecordId = await generateId(tx, "STAGE_RECORD");

                    await tx.oncology_stage_record.create({
                        data: {
                            stage_record_id: stageRecordId,
                            staging_detail_id: dto.staging_detail_id,
                            ...payload,
                            created_by: actingUserId,
                            created_at: new Date(),
                        },
                    });

                    await logAudit(tx, {
                        entity_type: "oncology_stage_record",
                        entity_id: stageRecordId,
                        action: AUDIT_ACTION.CREATE,
                        performed_by: actingUserId,
                        patient_id: detail.patient_id,
                        branch_id: detail.branch_id,
                        change_summary: JSON.stringify({
                            schema_id: record.schema_id,
                            context: record.context,
                            final_stage: finalStage,
                        }),
                    });
                }
            }

            // Mirror the most definitive stage onto the legacy columns so
            // printouts, the diagnosis card and chemotherapy validation keep
            // working. Rule codes are stored (M1, N2a) - m_stage.startsWith
            // ("M1") is what drives the metastatic rules.
            const activeRecords = await tx.oncology_stage_record.findMany({
                where: { staging_detail_id: dto.staging_detail_id, is_active: true },
            });

            const priority: Record<string, number> = {
                PATHOLOGICAL: 0,
                YP: 1,
                CLINICAL: 2,
                YC: 3,
                RECURRENCE: 4,
                AUTOPSY: 5,
            };

            const primary = [...activeRecords].sort(
                (a, b) =>
                    (a.cancer_type_id === cancerTypeId ? 0 : 1) -
                        (b.cancer_type_id === cancerTypeId ? 0 : 1) ||
                    (a.schema_role === "PRIMARY" ? 0 : 1) -
                        (b.schema_role === "PRIMARY" ? 0 : 1) ||
                    (priority[a.context] ?? 9) - (priority[b.context] ?? 9) ||
                    a.schema_id.localeCompare(b.schema_id)
            )[0];

            await tx.oncology_staging_detail.update({
                where: { staging_detail_id: dto.staging_detail_id },
                data: primary
                    ? {
                        clinical_stage: legacyStageText(primary.final_stage),
                        t_stage: primary.t_code,
                        n_stage: primary.n_code,
                        m_stage: primary.m_code,
                    }
                    : {
                        clinical_stage: null,
                        t_stage: null,
                        n_stage: null,
                        m_stage: null,
                    },
            });
        });

        return this.listRecords(dto.staging_detail_id);
    }

    async deactivateRecord(stageRecordId: string, actingUserId: string) {
        const row = await prisma.oncology_stage_record.findUnique({
            where: { stage_record_id: stageRecordId },
        });

        if (!row) {
            throw new Error("Stage record not found");
        }

        await prisma.$transaction(async (tx) => {
            await tx.oncology_stage_record.update({
                where: { id: row.id },
                data: {
                    is_active: false,
                    updated_by: actingUserId,
                    updated_at: new Date(),
                },
            });

            await logAudit(tx, {
                entity_type: "oncology_stage_record",
                entity_id: row.stage_record_id,
                action: AUDIT_ACTION.DEACTIVATE,
                performed_by: actingUserId,
                patient_id: row.patient_id,
                change_summary: "Stage record removed",
            });
        });

        return this.listRecords(row.staging_detail_id);
    }

    /** Normalise a numeric condition value (used by autofill previews). */
    static coerce(key: string, value: string | number | null | undefined) {
        return coerceConditionValue(key, value);
    }
}
