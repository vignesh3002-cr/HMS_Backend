import {
    CONTEXT_FAMILY,
    type ContextFamily,
    type DeriveResult,
    type DirectStageRow,
    type StageCategoryRow,
    type StageContext,
    type StageRuleRow,
} from "./types";
import { missingConditionKeys, unmatchedConditions } from "./conditions";

/**
 * The derivation engine. Pure functions only: the same code runs behind
 * POST /oncology/staging/derive, inside the save path, and in
 * scripts/verifyStaging.ts, so the browser preview and the stored stage can
 * never disagree.
 */

export const contextFamily = (context: StageContext): ContextFamily =>
    CONTEXT_FAMILY[context];

export const ruleAppliesTo = (
    rule: StageRuleRow,
    family: ContextFamily
): boolean => rule.context === "both" || rule.context === family;

export const categoryAppliesTo = (
    category: StageCategoryRow,
    family: ContextFamily
): boolean => category.context === "both" || category.context === family;

export function categoriesForContext(
    categories: StageCategoryRow[],
    context: StageContext
): StageCategoryRow[] {
    const family = contextFamily(context);
    return categories
        .filter((category) => categoryAppliesTo(category, family))
        .sort(
            (a, b) =>
                (a.display_order ?? 0) - (b.display_order ?? 0) ||
                a.shown_code.localeCompare(b.shown_code)
        );
}

export function rulesForContext(
    rules: StageRuleRow[],
    context: StageContext
): StageRuleRow[] {
    const family = contextFamily(context);
    return rules.filter((rule) => ruleAppliesTo(rule, family));
}

/**
 * TNM when the schema publishes rules for this context, DIRECT when it only
 * publishes a stage list (endometrium, lymphoma, BCLC, ...), NONE when neither.
 * Oesophageal SCC/adenocarcinoma (S14/S15) are TNM clinically and direct-entry
 * pathologically, so the mode is per context, not per schema.
 */
export function resolveMode(
    rules: StageRuleRow[],
    directStages: DirectStageRow[],
    context: StageContext
): "TNM" | "DIRECT" | "NONE" {
    if (rulesForContext(rules, context).length > 0) return "TNM";
    if (directStages.length > 0) return "DIRECT";
    return "NONE";
}

/** The shown code (cN1) for a rule code (N1) in this context. */
export function displayCodeFor(
    categories: StageCategoryRow[],
    axis: "T" | "N" | "M" | "S",
    ruleCode: string | null | undefined,
    context: StageContext
): string | null {
    if (!ruleCode) return null;
    const family = contextFamily(context);
    const match = categories.find(
        (category) =>
            category.axis === axis &&
            category.rule_code === ruleCode &&
            categoryAppliesTo(category, family)
    );
    return match?.shown_code ?? ruleCode;
}

export type DeriveInput = {
    context: StageContext;
    categories: StageCategoryRow[];
    rules: StageRuleRow[];
    directStages: DirectStageRow[];
    t?: string | null;
    n?: string | null;
    m?: string | null;
    s?: string | null;
    conditions?: Record<string, string | null>;
};

export type RuleMatch = {
    mode: "TNM" | "DIRECT" | "NONE";
    contextRules: StageRuleRow[];
    /** Rules whose T/N/M lists accept the selected codes. */
    usable: StageRuleRow[];
    /** Usable rules whose extra criteria are all satisfied. */
    matched: StageRuleRow[];
    missing: string[];
    /** T, N or M not supplied yet. */
    incomplete: boolean;
    values: Record<string, string | null>;
};

/**
 * The rule-matching half of the engine, exposed separately so the verification
 * script can mark every matched rule as reachable (several rules can describe
 * the same stage group, e.g. "T4b any N" and "any T N3" both = IVB).
 */
export function matchStageRules(input: DeriveInput): RuleMatch {
    const { context, rules, directStages, t, n, m, s, conditions = {} } = input;

    const mode = resolveMode(rules, directStages, context);
    const contextRules = rulesForContext(rules, context);

    const values: Record<string, string | null> = { ...conditions };
    // The S axis (IGCCCG) is a condition, not a grouping axis.
    if (s) values.S = s;

    if (!t || !n || !m) {
        return {
            mode,
            contextRules,
            usable: [],
            matched: [],
            missing: [],
            incomplete: true,
            values,
        };
    }

    const usable = contextRules.filter(
        (rule) =>
            rule.t_codes.includes(t) &&
            rule.n_codes.includes(n) &&
            rule.m_codes.includes(m)
    );

    const missing = missingConditionKeys(usable, values);
    const matched =
        missing.length > 0
            ? []
            : usable.filter((rule) => unmatchedConditions(rule, values).length === 0);

    return {
        mode,
        contextRules,
        usable,
        matched,
        missing,
        incomplete: false,
        values,
    };
}

export function deriveStage(input: DeriveInput): DeriveResult {
    const { context, t, n, m, directStages } = input;
    const match = matchStageRules(input);

    if (match.mode === "DIRECT") {
        return {
            status: "INCOMPLETE",
            mode: match.mode,
            derived_stage: null,
            rule_id: null,
            explanation:
                "This staging system publishes stage categories directly, without T/N/M grouping.",
            warnings: [],
            missing_conditions: [],
        };
    }

    if (match.mode === "NONE") {
        return {
            status: "NO_MATCH",
            mode: "TNM",
            derived_stage: null,
            rule_id: null,
            explanation: "No staging rules are published for this context.",
            warnings: [],
            missing_conditions: [],
        };
    }

    if (match.incomplete) {
        return {
            status: "INCOMPLETE",
            mode: match.mode,
            derived_stage: null,
            rule_id: null,
            explanation: null,
            warnings: [],
            missing_conditions: [],
        };
    }

    if (match.usable.length === 0) {
        return {
            status: "NO_MATCH",
            mode: match.mode,
            derived_stage: null,
            rule_id: null,
            explanation:
                "No stage group is defined for this T/N/M combination. Some combinations (for example carcinoma in situ with node-positive disease) are not staged by AJCC.",
            warnings: [],
            missing_conditions: [],
        };
    }

    if (match.missing.length > 0) {
        return {
            status: "INCOMPLETE",
            mode: match.mode,
            derived_stage: null,
            rule_id: null,
            explanation: "Additional staging criteria are required.",
            warnings: [],
            missing_conditions: match.missing,
        };
    }

    // Several workbook rows can describe the same group (e.g. T4b any N and
    // any T N3 both give IVB). Those are one answer, not an ambiguity.
    const byStage = new Map<string, StageRuleRow>();
    for (const rule of match.matched) {
        if (!byStage.has(rule.stage_group)) byStage.set(rule.stage_group, rule);
    }

    if (byStage.size === 1) {
        const rule = [...byStage.values()][0];
        return {
            status: "MATCHED",
            mode: match.mode,
            derived_stage: rule.stage_group,
            rule_id: rule.rule_id,
            explanation: rule.criteria_text || `${t} ${n} ${m}`,
            warnings: rule.flag ? [rule.flag] : [],
            missing_conditions: [],
        };
    }

    if (byStage.size === 0) {
        return {
            status: "NO_MATCH",
            mode: match.mode,
            derived_stage: null,
            rule_id: null,
            explanation:
                "The selected criteria do not match any published stage group.",
            warnings: [],
            missing_conditions: [],
        };
    }

    // The workbook's own QA asserts zero overlaps; if one ever appears we
    // return the first rule but flag it instead of hiding the ambiguity.
    const first = [...byStage.values()][0];
    return {
        status: "AMBIGUOUS",
        mode: match.mode,
        derived_stage: first.stage_group,
        rule_id: first.rule_id,
        explanation:
            `${byStage.size} stage groups match this combination; ` +
            `showing ${first.stage_group}. Clinician confirmation required.`,
        warnings: match.matched
            .map((rule) => rule.flag)
            .filter((flag): flag is string => Boolean(flag)),
        missing_conditions: [],
    };
}

/** Group the categories into the axes the card should render. */
export function axesForContext(
    categories: StageCategoryRow[],
    context: StageContext
): ("T" | "N" | "M" | "S")[] {
    const present = new Set(
        categoriesForContext(categories, context).map((category) => category.axis)
    );
    return (["T", "N", "M", "S"] as const).filter((axis) => present.has(axis));
}
