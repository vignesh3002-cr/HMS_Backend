import type { ConditionGroup, StageRuleRow } from "./types";

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

const normalize = (value: unknown): string =>
    String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/>=\s*/g, "≥")
        .replace(/<=\s*/g, "≤")
        .replace(/mm2/gi, "mm²")
        .toUpperCase();

/** Map a typed age to the workbook's "<55" / "≥55" bands. */
export function ageBand(age: number): string {
    return age < 55 ? "<55" : "≥55";
}

/** Map a numeric PSA to the workbook's three bands. */
export function psaBand(psa: number): string {
    if (psa < 10) return "<10";
    if (psa < 20) return "10-<20";
    return "≥20";
}

/**
 * Turn whatever the form / autofill supplied into the value a rule compares
 * against. Numbers are banded for Age and PSA; everything else is compared as
 * trimmed text.
 */
export function coerceConditionValue(
    key: string,
    raw: string | number | null | undefined
): string | null {
    if (raw === null || raw === undefined) return null;

    const text = String(raw).trim();
    if (!text) return null;

    const numeric = Number(text);
    const isNumeric = Number.isFinite(numeric) && !Number.isNaN(numeric);

    if (key === "Age" && isNumeric) return ageBand(numeric);
    if (key === "PSA" && isNumeric) return psaBand(numeric);

    return text;
}

/** Does one condition group accept the supplied value? */
export function conditionMatches(
    group: ConditionGroup,
    provided: Record<string, string | null>
): boolean {
    const value = provided[group.key];
    if (value === null || value === undefined || value === "") return false;

    const candidate = normalize(value);
    return group.values.some((accepted) => normalize(accepted) === candidate);
}

/**
 * All condition groups of a rule that the provided values do not satisfy.
 * An empty array means the rule's extra criteria are met.
 */
export function unmatchedConditions(
    rule: StageRuleRow,
    provided: Record<string, string | null>
): string[] {
    return rule.conditions
        .filter((group) => !conditionMatches(group, provided))
        .map((group) => group.key);
}

/** Rules whose extra criteria are still missing a value (used to prompt). */
export function missingConditionKeys(
    rules: StageRuleRow[],
    provided: Record<string, string | null>
): string[] {
    const missing = new Set<string>();
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
export function buildConditionValues(
    raw: Record<string, string | number | null | undefined> | undefined,
    criteria: { criterion_key: string }[]
): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    if (!raw) return out;

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
