import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

// Seeds the TNM staging master tables from the committed JSON extracted from
// EMR_Master_IHC_Genomics_TNM.xlsx (Nov 2026).
//
//   prisma/data/staging/schemas.json       64 staging systems / editions
//   prisma/data/staging/map.json           73 cancer type -> schema rows
//   prisma/data/staging/categories.json    743 T/N/M/S options
//   prisma/data/staging/rules.json         421 stage-group rules
//   prisma/data/staging/directStages.json  140 non-TNM stage lists
//   prisma/data/staging/criteria.json      7 rule condition inputs
//
// The master tables are fully rebuilt inside one transaction, so re-running
// always leaves the database matching the workbook exactly (no stale rows from
// an earlier revision). Rule / category ids are content hashes, so rows a
// stage record points at keep the same id across re-seeds.
//
//   npm run db:seed:staging

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DATA_DIR = path.join(__dirname, "data", "staging");

function load<T>(name: string): T {
    return JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf-8")
    ) as T;
}

// The workbook uses 48 clinical labels; the EMR has 38 cancer types because the
// leukaemia / lymphoma / CNS variants are grouped. This is the only place the
// two vocabularies meet.
const LABEL_TO_CANCER_TYPE: Record<string, string> = {
    "Breast": "Breast",
    "Lung – NSCLC": "Lung",
    "Lung – SCLC / NEC": "Lung",
    "Colorectal": "Colorectal",
    "Prostate": "Prostate",
    "Gastric / GEJ": "Gastric / GEJ",
    "Pancreatic": "Pancreatic",
    "Hepatocellular (HCC)": "Liver",
    "Ovarian (epithelial)": "Ovarian",
    "Endometrial": "Endometrial",
    "Cervical": "Cervical",
    "Bladder / Urothelial": "Bladder",
    "Renal (RCC)": "Kidney",
    "Thyroid": "Thyroid",
    "Melanoma": "Melanoma",
    "Head & Neck SCC": "Head & Neck",
    "Oesophageal": "Esophageal",
    "CNS – Glioma": "CNS",
    "CNS – Medulloblastoma / embryonal": "CNS",
    "Acute myeloid leukaemia": "Leukemia",
    "Acute lymphoblastic leukaemia / LBL": "Leukemia",
    "CLL / SLL": "Leukemia",
    "CML / MPN / MDS": "Leukemia",
    "Hodgkin lymphoma": "Lymphoma",
    "DLBCL / High-grade B-cell": "Lymphoma",
    "Follicular / Marginal-zone (indolent B-NHL)": "Lymphoma",
    "Mantle cell lymphoma": "Lymphoma",
    "T-cell / NK-cell lymphoma (PTCL, ALCL)": "Lymphoma",
    "Waldenström / Lymphoplasmacytic": "Lymphoma",
    "Multiple myeloma / plasma cell": "Myeloma",
    "Germ cell tumour": "Germ Cell Tumour",
    "Gestational trophoblastic neoplasia": "Gestational Trophoblastic Neoplasia",
    "Biliary tract": "Biliary tract",
    "Vulva": "Vulva",
    "Vagina": "Vagina",
    "Penile": "Penile",
    "Merkel cell carcinoma": "Merkel cell carcinoma",
    "GIST": "GIST",
    "Soft-tissue sarcoma": "Soft-tissue sarcoma",
    "Osteosarcoma / bone tumours": "Osteosarcoma / bone tumours",
    "Ewing sarcoma": "Ewing sarcoma",
    "Rhabdomyosarcoma": "Rhabdomyosarcoma",
    "Neuroendocrine tumour (GEP-NET / NEC)": "Neuroendocrine tumour (GEP-NET / NEC)",
    "Mesothelioma": "Mesothelioma",
    "Thymic epithelial tumour": "Thymic epithelial tumour",
    "Carcinoma of unknown primary": "Carcinoma of unknown primary",
    "Neuroblastoma": "Neuroblastoma",
    "Wilms tumour": "Wilms tumour",
};

// When a cancer type offers several mutually exclusive schemas and none is the
// obvious Primary, this picks the default shown first in the card.
const PREFERRED_SCHEMA: Record<string, string> = {
    "Germ Cell Tumour": "S37", // testis, not ovary
    "Leukemia": "N11",         // AML / ELN
    "Lymphoma": "N01",         // Lugano
    "CNS": "N05",              // WHO CNS grade
    "Biliary tract": "S20",    // intrahepatic
    "Esophageal": "S14",       // SCC
    "Thyroid": "S11",          // differentiated
    "Head & Neck": "S01",      // oral cavity
};

const ROLE_RANK: Record<string, number> = { PRIMARY: 0, SUBSITE: 1, ADDITIONAL: 2 };

const schemaNumber = (id: string) =>
    Number(String(id).replace(/\D/g, "")) || 0;

type MapRow = {
    map_id: string;
    cancer_type_id: string;
    cancer_type_label: string;
    schema_id: string;
    role: string;
    schema_name: string | null;
    system_edition: string | null;
    subsite_question: string | null;
    auto_select_rule: string | null;
    note: string | null;
    display_order: number;
};

async function main() {
    console.log("Seeding TNM staging master...");

    const schemas = load<any[]>("schemas");
    const rawMap = load<any[]>("map");
    const categories = load<any[]>("categories");
    const rules = load<any[]>("rules");
    const directStages = load<any[]>("directStages");
    const criteria = load<any[]>("criteria");

    // ---- resolve the workbook's 48 labels onto the EMR's 38 cancer types ----
    const cancerTypes = await prisma.cancer_types.findMany({
        select: { cancer_type_id: true, cancer_type: true },
    });
    const byName = new Map(cancerTypes.map((ct) => [ct.cancer_type.trim(), ct]));

    const unresolved: string[] = [];
    const resolved = new Map<string, { id: string; name: string }>();

    for (const label of new Set(rawMap.map((r) => r.cancer_type_label))) {
        const targetName = LABEL_TO_CANCER_TYPE[label];
        const ct = targetName ? byName.get(targetName) : undefined;
        if (!ct || !ct.cancer_type_id) {
            unresolved.push(`${label} -> ${targetName ?? "(no alias)"}`);
            continue;
        }
        resolved.set(label, { id: ct.cancer_type_id, name: ct.cancer_type });
    }

    if (unresolved.length) {
        throw new Error(
            "Staging map references cancer types the EMR does not have:\n  " +
            unresolved.join("\n  ")
        );
    }

    // ---- merge the labels that share one EMR cancer type -------------------
    const merged = new Map<string, MapRow>();

    for (const row of rawMap) {
        const ct = resolved.get(row.cancer_type_label)!;
        const role = String(row.role).toUpperCase().replace(/[-_\s]/g, "");
        const key = `${ct.id}|${row.schema_id}|${role}`;
        const existing = merged.get(key);

        if (!existing) {
            merged.set(key, {
                map_id: row.map_id,
                cancer_type_id: ct.id,
                cancer_type_label: row.cancer_type_label,
                schema_id: row.schema_id,
                role,
                schema_name: row.schema_name,
                system_edition: row.system_edition,
                subsite_question: row.subsite_question,
                auto_select_rule: row.auto_select_rule,
                note: row.note,
                display_order: 0,
            });
            continue;
        }

        // Same schema reached through a second label (Lung NSCLC + SCLC, ...):
        // keep one row and merge every distinct note / rule.
        const notes = [existing.note, row.note].filter(Boolean) as string[];
        existing.note = [...new Set(notes)].join(" · ") || null;
        existing.subsite_question ||= row.subsite_question;
        existing.auto_select_rule ||= row.auto_select_rule;
    }

    // ---- one Primary per cancer type; the rest become sub-site choices -----
    const byType = new Map<string, MapRow[]>();
    for (const row of merged.values()) {
        const list = byType.get(row.cancer_type_id) ?? [];
        list.push(row);
        byType.set(row.cancer_type_id, list);
    }

    for (const [typeId, rows] of byType) {
        const typeName = cancerTypes.find((ct) => ct.cancer_type_id === typeId)?.cancer_type ?? "";
        const preferred = PREFERRED_SCHEMA[typeName];
        const primaries = rows
            .filter((r) => r.role === "PRIMARY")
            .sort((a, b) => schemaNumber(a.schema_id) - schemaNumber(b.schema_id));

        if (primaries.length > 1) {
            const keep =
                primaries.find((r) => r.schema_id === preferred) ?? primaries[0];
            for (const row of primaries) {
                if (row === keep) continue;
                row.role = "SUBSITE";
                row.subsite_question ||= "Which disease / subtype?";
            }
        }
    }

    // ---- display order: primary first, then sub-sites, then add-ons --------
    for (const rows of byType.values()) {
        const typeName = cancerTypes.find((ct) => ct.cancer_type_id === rows[0].cancer_type_id)?.cancer_type ?? "";
        const preferred = PREFERRED_SCHEMA[typeName];
        for (const row of rows) {
            const rank = ROLE_RANK[row.role] ?? 3;
            const isPreferred = row.schema_id === preferred;
            row.display_order =
                rank * 100 + schemaNumber(row.schema_id) - (isPreferred ? 50 : 0);
        }
    }

    const mapRows = [...merged.values()].sort(
        (a, b) =>
            a.cancer_type_id.localeCompare(b.cancer_type_id) ||
            a.display_order - b.display_order
    );

    // ---- rebuild the master tables in one transaction ---------------------
    await prisma.$transaction([
        prisma.staging_map.deleteMany(),
        prisma.staging_category.deleteMany(),
        prisma.stage_rule.deleteMany(),
        prisma.direct_stage.deleteMany(),
        prisma.staging_schema.deleteMany(),
        prisma.staging_criterion.deleteMany(),

        prisma.staging_schema.createMany({ data: schemas }),
        prisma.staging_map.createMany({ data: mapRows }),
        prisma.staging_category.createMany({ data: categories }),
        prisma.stage_rule.createMany({
            data: rules.map((r) => ({
                rule_id: r.rule_id,
                schema_id: r.schema_id,
                context: r.context,
                stage_group: r.stage_group,
                t_codes: r.t_codes,
                n_codes: r.n_codes,
                m_codes: r.m_codes,
                conditions_raw: r.conditions_raw,
                conditions: r.conditions,
                criteria_text: r.criteria_text,
                flag: r.flag,
            })),
        }),
        prisma.direct_stage.createMany({ data: directStages }),
        prisma.staging_criterion.createMany({ data: criteria }),
    ]);

    const [schemaCount, mapCount, categoryCount, ruleCount, directCount, criterionCount] =
        await Promise.all([
            prisma.staging_schema.count(),
            prisma.staging_map.count(),
            prisma.staging_category.count(),
            prisma.stage_rule.count(),
            prisma.direct_stage.count(),
            prisma.staging_criterion.count(),
        ]);

    console.log("Staging master seeded:");
    console.log(`  schemas        ${schemaCount}`);
    console.log(`  map rows       ${mapCount}`);
    console.log(`  categories     ${categoryCount}`);
    console.log(`  stage rules    ${ruleCount}`);
    console.log(`  direct stages  ${directCount}`);
    console.log(`  criteria       ${criterionCount}`);
}

main()
    .catch((error) => {
        console.error("Staging seed failed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
