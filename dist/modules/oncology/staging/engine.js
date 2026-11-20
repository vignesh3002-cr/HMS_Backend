"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryAppliesTo = exports.ruleAppliesTo = exports.contextFamily = void 0;
exports.categoriesForContext = categoriesForContext;
exports.rulesForContext = rulesForContext;
exports.resolveMode = resolveMode;
exports.displayCodeFor = displayCodeFor;
exports.matchStageRules = matchStageRules;
exports.deriveStage = deriveStage;
exports.axesForContext = axesForContext;
const types_1 = require("./types");
const conditions_1 = require("./conditions");
/**
 * The derivation engine. Pure functions only: the same code runs behind
 * POST /oncology/staging/derive, inside the save path, and in
 * scripts/verifyStaging.ts, so the browser preview and the stored stage can
 * never disagree.
 */
const contextFamily = (context) => types_1.CONTEXT_FAMILY[context];
exports.contextFamily = contextFamily;
const ruleAppliesTo = (rule, family) => rule.context === "both" || rule.context === family;
exports.ruleAppliesTo = ruleAppliesTo;
const categoryAppliesTo = (category, family) => category.context === "both" || category.context === family;
exports.categoryAppliesTo = categoryAppliesTo;
function categoriesForContext(categories, context) {
    const family = (0, exports.contextFamily)(context);
    return categories
        .filter((category) => (0, exports.categoryAppliesTo)(category, family))
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) ||
        a.shown_code.localeCompare(b.shown_code));
}
function rulesForContext(rules, context) {
    const family = (0, exports.contextFamily)(context);
    return rules.filter((rule) => (0, exports.ruleAppliesTo)(rule, family));
}
/**
 * TNM when the schema publishes rules for this context, DIRECT when it only
 * publishes a stage list (endometrium, lymphoma, BCLC, ...), NONE when neither.
 * Oesophageal SCC/adenocarcinoma (S14/S15) are TNM clinically and direct-entry
 * pathologically, so the mode is per context, not per schema.
 */
function resolveMode(rules, directStages, context) {
    if (rulesForContext(rules, context).length > 0)
        return "TNM";
    if (directStages.length > 0)
        return "DIRECT";
    return "NONE";
}
/** The shown code (cN1) for a rule code (N1) in this context. */
function displayCodeFor(categories, axis, ruleCode, context) {
    if (!ruleCode)
        return null;
    const family = (0, exports.contextFamily)(context);
    const match = categories.find((category) => category.axis === axis &&
        category.rule_code === ruleCode &&
        (0, exports.categoryAppliesTo)(category, family));
    return match?.shown_code ?? ruleCode;
}
/**
 * The rule-matching half of the engine, exposed separately so the verification
 * script can mark every matched rule as reachable (several rules can describe
 * the same stage group, e.g. "T4b any N" and "any T N3" both = IVB).
 */
function matchStageRules(input) {
    const { context, rules, directStages, t, n, m, s, conditions = {} } = input;
    const mode = resolveMode(rules, directStages, context);
    const contextRules = rulesForContext(rules, context);
    const values = { ...conditions };
    // The S axis (IGCCCG) is a condition, not a grouping axis.
    if (s)
        values.S = s;
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
    const usable = contextRules.filter((rule) => rule.t_codes.includes(t) &&
        rule.n_codes.includes(n) &&
        rule.m_codes.includes(m));
    const missing = (0, conditions_1.missingConditionKeys)(usable, values);
    const matched = missing.length > 0
        ? []
        : usable.filter((rule) => (0, conditions_1.unmatchedConditions)(rule, values).length === 0);
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
function deriveStage(input) {
    const { context, t, n, m, directStages } = input;
    const match = matchStageRules(input);
    if (match.mode === "DIRECT") {
        return {
            status: "INCOMPLETE",
            mode: match.mode,
            derived_stage: null,
            rule_id: null,
            explanation: "This staging system publishes stage categories directly, without T/N/M grouping.",
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
            explanation: "No stage group is defined for this T/N/M combination. Some combinations (for example carcinoma in situ with node-positive disease) are not staged by AJCC.",
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
    const byStage = new Map();
    for (const rule of match.matched) {
        if (!byStage.has(rule.stage_group))
            byStage.set(rule.stage_group, rule);
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
            explanation: "The selected criteria do not match any published stage group.",
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
        explanation: `${byStage.size} stage groups match this combination; ` +
            `showing ${first.stage_group}. Clinician confirmation required.`,
        warnings: match.matched
            .map((rule) => rule.flag)
            .filter((flag) => Boolean(flag)),
        missing_conditions: [],
    };
}
/** Group the categories into the axes the card should render. */
function axesForContext(categories, context) {
    const present = new Set(categoriesForContext(categories, context).map((category) => category.axis));
    return ["T", "N", "M", "S"].filter((axis) => present.has(axis));
}
