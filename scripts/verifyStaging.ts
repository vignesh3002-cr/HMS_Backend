import * as fs from "fs";
import * as path from "path";
import {
    contextFamily,
    matchStageRules,
    resolveMode,
    rulesForContext,
    categoriesForContext,
} from "../src/modules/oncology/staging/engine";
import type {
    ContextFamily,
    StageCategoryRow,
    StageContext,
    StageRuleRow,
    DirectStageRow,
} from "../src/modules/oncology/staging/types";

// Verifies the seeded staging tables against the workbook's own QA claims
// (Staging_QA: 46 schema x context pairs enumerated, 0 overlaps, 0 unexpected
// gaps). Runs on the committed JSON, so it needs no database.
//
//   npm run verify:staging

const DATA_DIR = path.join(__dirname, "..", "prisma", "data", "staging");
const load = <T>(name: string): T =>
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf-8")) as T;

const categories = load<StageCategoryRow[]>("categories");
const rules = load<StageRuleRow[]>("rules");
const directStages = load<DirectStageRow[]>("directStages");
const schemas = load<{ schema_id: string; schema_name: string }[]>("schemas");
const criteria = load<{ criterion_key: string; options: string[] }[]>("criteria");

// Age is stored as two bands even though the form types a number.
const CONDITION_DOMAIN: Record<string, string[]> = {
    Age: ["<55", "≥55"],
};
for (const criterion of criteria) {
    CONDITION_DOMAIN[criterion.criterion_key] ??= criterion.options;
}

const CONTEXTS: StageContext[] = ["CLINICAL", "PATHOLOGICAL"];

function product<T>(lists: T[][]): T[][] {
    return lists.reduce<T[][]>(
        (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
        [[]]
    );
}

type Problem = { schema: string; context: string; detail: string };

const overlaps: Problem[] = [];
const reachable = new Set<string>();
const enumerated: Record<string, number> = {};
const unmatched: Record<string, number> = {};
const unexpectedGaps: Problem[] = [];
let expectedGaps = 0;

let pairs = 0;
let combinations = 0;

for (const schema of schemas) {
    const schemaRules = rules.filter((rule) => rule.schema_id === schema.schema_id);
    const schemaCategories = categories.filter((c) => c.schema_id === schema.schema_id);
    const schemaDirect = directStages.filter((d) => d.schema_id === schema.schema_id);

    for (const context of CONTEXTS) {
        const family: ContextFamily = contextFamily(context);
        const mode = resolveMode(schemaRules, schemaDirect, context);
        if (mode !== "TNM") continue;

        pairs += 1;

        const ctxRules = rulesForContext(schemaRules, context);
        const ctxCategories = categoriesForContext(schemaCategories, context);

        const axes = (["T", "N", "M"] as const).map((axis) => {
            const codes = [
                ...new Set(
                    ctxCategories
                        .filter((category) => category.axis === axis)
                        .map((category) => category.rule_code)
                ),
            ];
            // TX / NX / MX mean "cannot be assessed" and are legitimately not
            // staged by AJCC, so they are counted as not-assessable rather
            // than as gaps.
            return codes.filter((code) => code !== "TX" && code !== "NX" && code !== "MX");
        });

        const conditionKeys = [
            ...new Set(ctxRules.flatMap((rule) => rule.conditions.map((g) => g.key))),
        ];
        const domains = conditionKeys.map((key) => CONDITION_DOMAIN[key] ?? []);

        const combos = product(axes).flatMap(([t, n, m]) =>
            product(domains).map((condValues) => ({
                t,
                n,
                m,
                conditions: Object.fromEntries(
                    conditionKeys.map((key, index) => [key, condValues[index]])
                ) as Record<string, string>,
            }))
        );

        let matched = 0;
        let missed = 0;

        for (const combo of combos) {
            combinations += 1;
            const result = matchStageRules({
                context,
                categories: ctxCategories,
                rules: ctxRules,
                directStages: schemaDirect,
                t: combo.t,
                n: combo.n,
                m: combo.m,
                conditions: combo.conditions,
            });

            const stages = new Set(
                result.matched.map((rule) => rule.stage_group)
            );

            if (stages.size === 1) {
                matched += 1;
                for (const rule of result.matched) reachable.add(rule.rule_id);
            } else if (stages.size > 1) {
                overlaps.push({
                    schema: schema.schema_id,
                    context,
                    detail: `${combo.t} ${combo.n} ${combo.m} ${JSON.stringify(combo.conditions)} -> ${[...stages].join(" / ")}`,
                });
            } else {
                missed += 1;
                // The workbook itself documents the exceptions: carcinoma in
                // situ / Ta with positive nodes are not staged, T0 (no
                // evidence of primary) is not part of the grouping tables, and
                // IGCCCG stages cannot be derived when markers are SX.
                const expected =
                    combo.t === "T0" ||
                    combo.t === "Tis" ||
                    combo.t === "Ta" ||
                    combo.conditions?.S === "SX";
                if (expected) {
                    expectedGaps += 1;
                } else {
                    unexpectedGaps.push({
                        schema: schema.schema_id,
                        context,
                        detail: `${combo.t} ${combo.n} ${combo.m} ${JSON.stringify(combo.conditions)}`,
                    });
                }
            }
        }

        enumerated[`${schema.schema_id}/${context}`] = matched;
        unmatched[`${schema.schema_id}/${context}`] = missed;
    }
}

// Rules that no combination can reach are dead rows in the workbook.
const deadRules = rules.filter((rule) => !reachable.has(rule.rule_id));

// A category whose rule code no rule mentions is an option that can never
// contribute to a stage. TX / NX / MX are legitimately unused ("cannot be
// assessed"), so they are not counted.
const orphanCategories = categories.filter((category) => {
    if (category.axis === "S") return false;
    if (["TX", "NX", "MX"].includes(category.rule_code)) return false;
    return !rules.some(
        (rule) =>
            rule.schema_id === category.schema_id &&
            (rule.context === "both" ||
                rule.context === category.context ||
                category.context === "both") &&
            (category.axis === "T"
                ? rule.t_codes
                : category.axis === "N"
                    ? rule.n_codes
                    : rule.m_codes
            ).includes(category.rule_code)
    );
});

console.log("TNM staging verification");
console.log("------------------------");
console.log(`schemas                 ${schemas.length}`);
console.log(`schema x context pairs  ${pairs}`);
console.log(`combinations evaluated  ${combinations}`);
console.log(`rules                   ${rules.length}`);
console.log(`rules reachable         ${rules.length - deadRules.length}`);
console.log(`overlaps                ${overlaps.length}`);
console.log(`expected gaps           ${expectedGaps}  (T0 / Tis / Ta, or IGCCCG SX)`);
console.log(`unexpected gaps         ${unexpectedGaps.length}`);
console.log(`unreachable rules       ${deadRules.length}`);
console.log(`orphan category codes   ${orphanCategories.length}`);

if (unexpectedGaps.length) {
    console.log("\nUNEXPECTED GAPS:");
    for (const gap of unexpectedGaps.slice(0, 40)) {
        console.log(`  ${gap.schema}/${gap.context} ${gap.detail}`);
    }
    if (unexpectedGaps.length > 40) {
        console.log(`  ... ${unexpectedGaps.length - 40} more`);
    }
}

if (deadRules.length) {
    console.log("\nUnreachable rules:");
    for (const rule of deadRules.slice(0, 25)) {
        console.log(
            `  ${rule.schema_id} ${rule.context} ${rule.stage_group} ` +
            `T=${rule.t_codes.join(",")} N=${rule.n_codes.join(",")} ` +
            `M=${rule.m_codes.join(",")} ${rule.conditions_raw ?? ""}`
        );
    }
    if (deadRules.length > 25) console.log(`  ... ${deadRules.length - 25} more`);
}

if (orphanCategories.length) {
    console.log("\nCategory codes no rule references:");
    for (const category of orphanCategories.slice(0, 25)) {
        console.log(
            `  ${category.schema_id} ${category.axis} ${category.shown_code} ` +
            `(${category.rule_code}) ${category.context}`
        );
    }
    if (orphanCategories.length > 25) {
        console.log(`  ... ${orphanCategories.length - 25} more`);
    }
}

if (overlaps.length) {
    console.log("\nOVERLAPS (must be zero):");
    for (const overlap of overlaps.slice(0, 25)) {
        console.log(`  ${overlap.schema}/${overlap.context} ${overlap.detail}`);
    }
}

const failed = overlaps.length > 0 || deadRules.length > 0;
if (failed) {
    console.error("\nFAILED: staging tables do not satisfy the workbook QA.");
    process.exitCode = 1;
} else {
    console.log("\nOK: no overlapping or unreachable stage rules.");
}
