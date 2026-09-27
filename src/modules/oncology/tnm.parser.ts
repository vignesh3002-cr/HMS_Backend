import { M_STAGE_VALUES, N_STAGE_VALUES, T_STAGE_VALUES } from "./oncology.constants";

// staging_reference.tnm_criteria is free text written for clinicians
// ("T1a/b/c", "T3-4a", "Any T N1-3 M0", "Ta ...; Tis ...; T1 ..."). This
// turns one criteria phrase into the individual T / N / M values it names,
// limited to the values the staging tables can store, so the Diagnosis
// dropdowns never offer an option that can't be saved.

const ALLOWED: Record<"T" | "N" | "M", string[]> = {
    T: T_STAGE_VALUES,
    N: N_STAGE_VALUES,
    M: M_STAGE_VALUES
};

// Order of the sub-stage suffixes within one number (T4 < T4a < T4b < T4d).
const SUFFIX_ORDER = ["", "mi", "a", "b", "c", "d"];

const rank = (suffix: string) => SUFFIX_ORDER.indexOf(suffix);

// "T1a" -> { n: 1, suffix: "a" }; "Tx" / "Tis" have no number.
function numbered(value: string): { n: number; suffix: string } | null {
    const match = value.match(/^[TNM](\d)(.*)$/);
    return match ? { n: Number(match[1]), suffix: match[2] } : null;
}

// Allowed values from start to end inclusive: "T3-4a" -> T3, T4, T4a;
// "T2b-4b" -> T2b, T3, T4, T4a, T4b; "N1-3" -> N1 ... N3c.
function expandRange(letter: "T" | "N" | "M", startN: number, startSuffix: string, endN: number, endSuffix: string) {
    return ALLOWED[letter].filter((value) => {
        const parts = numbered(value);
        if (!parts || parts.n < startN || parts.n > endN) return false;
        if (parts.n === startN && startSuffix && rank(parts.suffix) < rank(startSuffix)) return false;
        if (parts.n === endN && endSuffix && rank(parts.suffix) > rank(endSuffix)) return false;
        return true;
    });
}

// One token: T/N/M, then x | is | digit, a sub-stage (mi or a-d), extra
// "/b/c" sub-stages, and an optional "-4a" / "-b" range end. Not preceded
// by a letter (so "LN", "CNS", "TP53", "NPM1" never match).
const TOKEN = /(?<![A-Za-z])([TNM])(x|X|is|\d)(mi|[a-dA-D])?((?:\/(?:mi|[a-dA-D]))*)(?:\s*[-–]\s*(\d)?(mi|[a-dA-D])?)?(?![A-Za-z0-9])/g;

export type TnmValues = { t_values: string[]; n_values: string[]; m_values: string[] };

export function parseTnmValues(criteria: string | null | undefined): TnmValues {

    const found: Record<"T" | "N" | "M", Set<string>> = { T: new Set(), N: new Set(), M: new Set() };

    // Parenthesised text is commentary ("T1 (lamina propria)").
    const text = (criteria ?? "").replace(/\([^)]*\)/g, " ");

    for (const match of text.matchAll(TOKEN)) {

        const letter = match[1] as "T" | "N" | "M";
        const head = match[2];
        const suffix = (match[3] ?? "").toLowerCase();
        const extraSuffixes = (match[4] ?? "").split("/").filter(Boolean).map((s) => s.toLowerCase());
        const hasRange = match[5] !== undefined || match[6] !== undefined;

        let values: string[];

        if (!/\d/.test(head)) {
            // Tx / Nx / Tis
            values = [`${letter}${head.toLowerCase() === "x" ? "x" : "is"}`];
        } else if (hasRange) {
            const endN = match[5] !== undefined ? Number(match[5]) : Number(head);
            values = expandRange(letter, Number(head), suffix, endN, (match[6] ?? "").toLowerCase());
        } else {
            values = [suffix, ...extraSuffixes].map((s) => `${letter}${head}${s}`);
        }

        for (const value of values) {
            if (ALLOWED[letter].includes(value)) {
                found[letter].add(value);
            }
        }

    }

    const ordered = (letter: "T" | "N" | "M") => ALLOWED[letter].filter((value) => found[letter].has(value));

    return { t_values: ordered("T"), n_values: ordered("N"), m_values: ordered("M") };

}
