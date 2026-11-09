import "dotenv/config";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const EXCEL_PATH = "C:\\Users\\ADMIN\\Downloads\\EMR_Risk_Prognostic_Scores.xlsx";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type CatRow = {
    scoreId: string;
    name: string;
    cancerTypes: string[];
    purpose: string | null;
    whenToRecord: string | null;
    method: string | null;
    range: string | null;
    riskGroups: string | null;
    status: string | null;
    reference: string | null;
    developerNote: string | null;
    variablesCount: number | null;
    autoFilledCount: number | null;
    autoFillPercent: number | null;
};

type VarRow = {
    scoreId: string;
    score: string;
    variable: string | null;
    criterion: string | null;
    points: string | null;
    source: string | null;
    autoFilled: boolean;
    sourceField: string | null;
};

type GroupRow = {
    scoreId: string;
    score: string;
    groupRange: string | null;
    meaning: string | null;
    order: number | null;
};

const toStr = (v: any): string | null => (v == null || v === "" ? null : String(v));
const toNum = (v: any): number | null => (v == null || v === "" ? null : Number(v));

const sheetRows = (name: string): any[][] => {
    const ws = XLSX.readFile(EXCEL_PATH).Sheets[name];
    return XLSX.utils.sheet_to_json(ws, { header: 1 });
};

const cleanTypeName = (name: string): string => name.trim();

async function main() {
    console.log("=== Seeding score master from EMR_Risk_Prognostic_Scores.xlsx ===");

    const catalogueRaw = sheetRows("Score_Catalogue");
    const variablesRaw = sheetRows("Score_Variables");
    const groupsRaw = sheetRows("Score_Groups");

    // Resolve cancer type names -> cancer_type_id.
    const types = await prisma.cancer_types.findMany({ where: { active_status: 1 } });
    const typeByName = new Map(types.map((t) => [t.cancer_type, t.cancer_type_id]));
    const missingTypes = new Set<string>();

    // Excel cancer type names -> short DB cancer_type names (cancer_types table
    // holds broad groups; Excel holds 48 disease-specific types). Best-effort
    // mapping so a score is offered under its primary cancer type.
    const TYPE_ALIASES: Record<string, string> = {
        "Breast": "Breast",
        "Lung – NSCLC": "Lung",
        "Lung – SCLC / NEC": "Lung",
        "Colorectal": "Colorectal",
        "Gastric / GEJ": "Gastric / GEJ",
        "Oesophageal": "Esophageal",
        "Pancreatic": "Pancreatic",
        "Hepatocellular (HCC)": "Liver",
        "Ovarian (epithelial)": "Ovarian",
        "Endometrial": "Endometrial",
        "Cervical": "Cervical",
        "Prostate": "Prostate",
        "Bladder / Urothelial": "Bladder",
        "Renal (RCC)": "Kidney",
        "Head & Neck SCC": "Head & Neck",
        "Thyroid": "Thyroid",
        "Melanoma": "Melanoma",
        "CNS – Glioma": "CNS",
        "CNS – Medulloblastoma / embryonal": "CNS",
        "Germ cell tumour": "Germ Cell Tumour",
        "Gestational trophoblastic neoplasia": "Gestational Trophoblastic Neoplasia",
        "DLBCL / High-grade B-cell": "Lymphoma",
        "Hodgkin lymphoma": "Lymphoma",
        "Mantle cell lymphoma": "Lymphoma",
        "Follicular / Marginal-zone (indolent B-NHL)": "Lymphoma",
        "T-cell / NK-cell lymphoma (PTCL, ALCL)": "Lymphoma",
        "Multiple myeloma / plasma cell": "Myeloma",
        "Waldenström / Lymphoplasmacytic": "Myeloma",
        "Acute myeloid leukaemia": "Leukemia",
        "Acute lymphoblastic leukaemia / LBL": "Leukemia",
        "CLL / SLL": "Leukemia",
        "CML / MPN / MDS": "Leukemia",
    };

    const resolveTypeId = (name: string): string | null => {
        const alias = TYPE_ALIASES[name] ?? name;
        const id = typeByName.get(cleanTypeName(alias));
        if (!id) missingTypes.add(name);
        return id ?? null;
    };

    // --- Score_Catalogue -> cancer_score (one row per score_id) ---
    const catalogue = new Map<string, CatRow>();
    for (let i = 1; i < catalogueRaw.length; i++) {
        const r = catalogueRaw[i];
        if (!r || !r[0]) continue;
        const scoreId = String(r[0]).trim();
        const typesCsv = toStr(r[2]) ?? "";
        const cancerTypes = typesCsv.split(",").map(cleanTypeName).filter(Boolean);
        catalogue.set(scoreId, {
            scoreId,
            name: toStr(r[1]) ?? "",
            cancerTypes,
            purpose: toStr(r[3]),
            whenToRecord: toStr(r[4]),
            method: toStr(r[5]),
            range: toStr(r[6]),
            riskGroups: toStr(r[7]),
            status: toStr(r[8]),
            reference: toStr(r[9]),
            developerNote: toStr(r[10]),
            variablesCount: toNum(r[11]),
            autoFilledCount: toNum(r[12]),
            autoFillPercent: toNum(r[13]),
        });
    }

    let scoreAdded = 0;
    let scoreUpdated = 0;
    for (const [scoreId, cat] of catalogue) {
        const typeId = cat.cancerTypes.length > 0 ? resolveTypeId(cat.cancerTypes[0]) : null;
        if (!typeId) {
            console.warn(`  skip cancer_score ${scoreId} "${cat.name}" - no resolvable cancer type`);
            continue;
        }
        const data = {
            cancer_type_id: typeId,
            score_system: cat.name,
            score_value: cat.name,
            input_type: cat.method,
            score_rule: `${cat.purpose ?? ""} ${cat.whenToRecord ?? ""}`.trim() || null,
            applies_to: cat.cancerTypes.join(", "),
            subtype_keywords: null,
            active_status: 1,
        };
        const exists = await prisma.cancer_score.findUnique({ where: { score_id: scoreId } });
        if (exists) {
            await prisma.cancer_score.update({ where: { score_id: scoreId }, data });
            scoreUpdated++;
        } else {
            await prisma.cancer_score.create({ data: { score_id: scoreId, ...data } });
            scoreAdded++;
        }
    }

    // --- Score_Variables -> cancer_score_variable ---
    const variablesByScore = new Map<string, VarRow[]>();
    for (let i = 1; i < variablesRaw.length; i++) {
        const r = variablesRaw[i];
        if (!r || !r[0]) continue;
        const scoreId = String(r[0]).trim();
        const row: VarRow = {
            scoreId,
            score: toStr(r[1]) ?? "",
            variable: toStr(r[2]),
            criterion: toStr(r[3]),
            points: toStr(r[4]),
            source: toStr(r[5]) ?? "",
            autoFilled: String(r[6]).trim().toLowerCase() === "yes",
            sourceField: toStr(r[7]),
        };
        const list = variablesByScore.get(scoreId) ?? [];
        list.push(row);
        variablesByScore.set(scoreId, list);
    }

    let varCreated = 0;
    let varMatched = 0;
    for (const [scoreId, vars] of variablesByScore) {
        for (const [idx, row] of vars.entries()) {
            const scoreVariableId = `SCVR-${scoreId}-${String(idx + 1).padStart(3, "0")}`;
            const data = {
                score_id: scoreId,
                variable_name: row.variable ?? "",
                criterion: row.criterion,
                points: row.points,
                source: row.source || "CLIN",
                auto_filled: row.autoFilled,
                source_field: row.sourceField,
                display_order: idx + 1,
                active_status: 1,
            };
            try {
                await prisma.cancer_score_variable.upsert({
                    where: { score_variable_id: scoreVariableId },
                    create: { score_variable_id: scoreVariableId, ...data },
                    update: data,
                });
                if (row.autoFilled) varMatched++; else varCreated++;
            } catch (e: any) {
                console.error(`  variable upsert failed ${scoreVariableId}:`, e.message);
            }
        }
    }

    // --- Score_Groups -> cancer_score_group ---
    const groupsByScore = new Map<string, GroupRow[]>();
    for (let i = 1; i < groupsRaw.length; i++) {
        const r = groupsRaw[i];
        if (!r || !r[0]) continue;
        const scoreId = String(r[0]).trim();
        const row: GroupRow = {
            scoreId,
            score: toStr(r[1]) ?? "",
            groupRange: toStr(r[2]),
            meaning: toStr(r[3]),
            order: toNum(r[4]) ?? 1,
        };
        const list = groupsByScore.get(scoreId) ?? [];
        list.push(row);
        groupsByScore.set(scoreId, list);
    }

    let groupCreated = 0;
    for (const [scoreId, groups] of groupsByScore) {
        for (const [idx, row] of groups.entries()) {
            const scoreGroupId = `SCGR-${scoreId}-${String(idx + 1).padStart(3, "0")}`;
            const data = {
                score_id: scoreId,
                group_range: row.groupRange ?? "",
                meaning: row.meaning,
                sort_order: row.order ?? idx + 1,
                active_status: 1,
            };
            try {
                await prisma.cancer_score_group.upsert({
                    where: { score_group_id: scoreGroupId },
                    create: { score_group_id: scoreGroupId, ...data },
                    update: data,
                });
                groupCreated++;
            } catch (e: any) {
                console.error(`  group upsert failed ${scoreGroupId}:`, e.message);
            }
        }
    }

    const sCount = await prisma.cancer_score.count();
    const vCount = await prisma.cancer_score_variable.count();
    const gCount = await prisma.cancer_score_group.count();

    console.log(`  cancer_score: ${scoreAdded} added, ${scoreUpdated} refreshed (${sCount} total)`);
    console.log(`  cancer_score_variable: ${varCreated} created, ${varMatched} existing auto-filled (${vCount} total)`);
    console.log(`  cancer_score_group: ${groupCreated} rows (${gCount} total)`);
    if (missingTypes.size > 0) {
        console.warn("  Unresolved cancer type names:", [...missingTypes].join(", "));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
