"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ageBand = ageBand;
exports.psaBand = psaBand;
exports.coerceConditionValue = coerceConditionValue;
exports.conditionMatches = conditionMatches;
exports.unmatchedConditions = unmatchedConditions;
exports.missingConditionKeys = missingConditionKeys;
exports.buildConditionValues = buildConditionValues;
// Stage rules carry their extra factors as text, e.g.
//   "PSA = <10 / 10-<20; GG = 1"
//   "Site = Gastric/omental; Mitosis = ≤5/5mm²"
//   "Age = ≥55"
// Each `;` group is AND, each `/` value inside a group is OR. Values can
// themselves contain "/" (Gastric/omental), so splitting is done on " / "
// rather than on "/".
//
// The clinician picks a band (PSA) or an exact value (GG, Grade, S, Site,
// Mitosis); Age is typed as a number and mapped to the workbook's two bands.
const normalize = (value) => String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/>=\s*/g, "≥")
    .replace(/<=\s*/g, "≤")
    .replace(/mm2/gi, "mm²")
    .toUpperCase();
/** Map a typed age to the workbook's "<55" / "≥55" bands. */
function ageBand(age) {
    return age < 55 ? "<55" : "≥55";
}
/** Map a numeric PSA to the workbook's three bands. */
function psaBand(psa) {
    if (psa < 10)
        return "<10";
    if (psa < 20)
        return "10-<20";
    return "≥20";
}
/**
 * Turn whatever the form / autofill supplied into the value a rule compares
 * against. Numbers are banded for Age and PSA; everything else is compared as
 * trimmed text.
 */
function coerceConditionValue(key, raw) {
    if (raw === null || raw === undefined)
        return null;
    const text = String(raw).trim();
    if (!text)
        return null;
    const numeric = Number(text);
    const isNumeric = Number.isFinite(numeric) && !Number.isNaN(numeric);
    if (key === "Age" && isNumeric)
        return ageBand(numeric);
    if (key === "PSA" && isNumeric)
        return psaBand(numeric);
    return text;
}
/** Does one condition group accept the supplied value? */
function conditionMatches(group, provided) {
    const value = provided[group.key];
    if (value === null || value === undefined || value === "")
        return false;
    const candidate = normalize(value);
    return group.values.some((accepted) => normalize(accepted) === candidate);
}
/**
 * All condition groups of a rule that the provided values do not satisfy.
 * An empty array means the rule's extra criteria are met.
 */
function unmatchedConditions(rule, provided) {
    return rule.conditions
        .filter((group) => !conditionMatches(group, provided))
        .map((group) => group.key);
}
/** Rules whose extra criteria are still missing a value (used to prompt). */
function missingConditionKeys(rules, provided) {
    const missing = new Set();
    for (const rule of rules) {
        for (const group of rule.conditions) {
            const value = provided[group.key];
            if (value === null || value === undefined || value === "") {
                missing.add(group.key);
            }
        }
    }
    return [...missing];
}
/** Build the normalised condition map once, for engine + service reuse. */
function buildConditionValues(raw, criteria) {
    const out = {};
    if (!raw)
        return out;
    for (const [key, value] of Object.entries(raw)) {
        out[key] = coerceConditionValue(key, value);
    }
    // Make sure every known criterion has an entry (null when not supplied).
    for (const criterion of criteria) {
        if (!(criterion.criterion_key in out)) {
            out[criterion.criterion_key] = null;
        }
    }
    return out;
}
