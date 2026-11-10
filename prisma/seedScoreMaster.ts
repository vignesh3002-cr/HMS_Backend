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
    autoFillPercent: string | null;
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

const workbook = XLSX.readFile(EXCEL_PATH);
const sheetRows = (name: string): any[][] =>
    XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });

/*
 * The Excel master names 48 disease-specific cancer types. The EMR already
 * has 22 broader types (CT001–CT024). We keep those and add the 16 types
 * that have no broad equivalent, then map every Excel type onto exactly one
 * EMR type. This makes all 78 catalogue scores reachable without duplicating
 * existing cancer types or changing their IDs.
 */
const TYPE_MAP: Record<string, string> = {
    "Breast": "Breast",
    "Lung – NSCLC": "Lung",
    "Lung – SCLC / NEC": "Lung",
    "Colorectal": "Colorectal",
    "Gastric / GEJ": "Gastric / GEJ",
    "Oesophageal": "Esophageal",
    "Pancreatic": "Pancreatic",
    "Biliary tract": "Biliary tract",
    "Hepatocellular (HCC)": "Liver",
    "Ovarian (epithelial)": "Ovarian",
    "Endometrial": "Endometrial",
    "Cervical": "Cervical",
    "Vulva": "Vulva",
    "Vagina": "Vagina",
    "Prostate": "Prostate",
    "Bladder / Urothelial": "Bladder",
    "Renal (RCC)": "Kidney",
    "Penile": "Penile",
    "Head & Neck SCC": "Head & Neck",
    "Thyroid": "Thyroid",
    "Melanoma": "Melanoma",
    "Merkel cell carcinoma": "Merkel cell carcinoma",
    "GIST": "GIST",
    "Soft-tissue sarcoma": "Soft-tissue sarcoma",
    "Osteosarcoma / bone tumours": "Osteosarcoma / bone tumours",
    "Ewing sarcoma": "Ewing sarcoma",
    "Rhabdomyosarcoma": "Rhabdomyosarcoma",
    "CNS – Glioma": "CNS",
    "CNS – Medulloblastoma / embryonal": "CNS",
    "Neuroendocrine tumour (GEP-NET / NEC)": "Neuroendocrine tumour (GEP-NET / NEC)",
    "Germ cell tumour": "Germ Cell Tumour",
    "Gestational trophoblastic neoplasia": "Gestational Trophoblastic Neoplasia",
    "Mesothelioma": "Mesothelioma",
    "Thymic epithelial tumour": "Thymic epithelial tumour",
    "Carcinoma of unknown primary": "Carcinoma of unknown primary",
    "Neuroblastoma": "Neuroblastoma",
    "Wilms tumour": "Wilms tumour",
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

const NEW_TYPE_NAMES = Array.from(new Set(Object.values(TYPE_MAP))).filter(
    (name) => ![
        "Breast", "Lung", "Colorectal", "Gastric / GEJ", "Esophageal",
        "Pancreatic", "Liver", "Ovarian", "Endometrial", "Cervical",
        "Prostate", "Bladder", "Kidney", "Head & Neck", "Thyroid",
        "Melanoma", "CNS", "Germ Cell Tumour",
        "Gestational Trophoblastic Neoplasia", "Lymphoma", "Myeloma",
        "Leukemia",
    ].includes(name)
);

const excelTypeToDb = (name: string): string | null =>
    TYPE_MAP[name.trim()] ?? null;

async function ensureCancerTypes(): Promise<Map<string, string>> {
    const existing = await prisma.cancer_types.findMany();
    const byName = new Map<string, string>(
        existing
            .filter((row) => row.cancer_type_id)
            .map((row) => [row.cancer_type, row.cancer_type_id as string])
    );

    let nextNumber =
        Math.max(
            0,
            ...existing
                .map((row) => Number((row.cancer_type_id ?? "").replace(/^CT0*/, "")))
                .filter((value) => Number.isFinite(value))
        ) + 1;

    for (const name of NEW_TYPE_NAMES) {
        if (byName.has(name)) continue;
        const cancerTypeId = `CT${String(nextNumber).padStart(3, "0")}`;
        await prisma.cancer_types.create({
            data: {
                cancer_type_id: cancerTypeId,
                cancer_type: name,
                staging_system: null,
                active_status: 1,
            },
        });
        byName.set(name, cancerTypeId);
        nextNumber++;
        console.log(`  + cancer type ${cancerTypeId} ${name}`);
    }

    return byName;
}

async function main() {
    console.log("=== Seeding score master from EMR_Risk_Prognostic_Scores.xlsx ===");

    const typeByName = await ensureCancerTypes();

    const catalogueRaw = sheetRows("Score_Catalogue");
    const variablesRaw = sheetRows("Score_Variables");
    const groupsRaw = sheetRows("Score_Groups");
    const mapRaw = sheetRows("Cancer_Score_Map");

    // --- Score_Catalogue -> cancer_score ---
    const catalogue = new Map<string, CatRow>();
    for (let i = 1; i < catalogueRaw.length; i++) {
        const r = catalogueRaw[i];
        if (!r || !r[0]) continue;
        const scoreId = String(r[0]).trim();
        const typesCsv = toStr(r[2]) ?? "";
        const cancerTypes = typesCsv.split(",").map((name: string) => name.trim()).filter(Boolean);
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
            autoFillPercent: toStr(r[13]),
        });
    }

    // --- Cancer_Score_Map -> score <-> cancer type links ---
    const scoreTypes = new Map<string, string[]>();
    for (let i = 1; i < mapRaw.length; i++) {
        const r = mapRaw[i];
        if (!r || !r[0] || !r[1]) continue;
        const dbType = excelTypeToDb(String(r[0]));
        if (!dbType) {
            console.warn(`  map row skipped: unknown cancer type "${r[0]}"`);
            continue;
        }
        const scoreId = String(r[1]).trim();
        const list = scoreTypes.get(scoreId) ?? [];
        if (!list.includes(dbType)) list.push(dbType);
        scoreTypes.set(scoreId, list);
    }

    let scoreAdded = 0;
    let scoreUpdated = 0;
    let order = 0;
    for (const [scoreId, cat] of catalogue) {
        order++;
        const mapped = scoreTypes.get(scoreId) ?? [];
        const primaryType =
            mapped[0] ??
            excelTypeToDb(cat.cancerTypes[0] ?? "") ??
            null;
        if (!primaryType) {
            console.warn(`  skip cancer_score ${scoreId} "${cat.name}" - no resolvable cancer type`);
            continue;
        }
        const primaryTypeId = typeByName.get(primaryType);
        if (!primaryTypeId) {
            console.warn(`  skip cancer_score ${scoreId} - type "${primaryType}" has no id`);
            continue;
        }

        const data = {
            cancer_type_id: primaryTypeId,
            score_system: cat.name,
            score_value: cat.name,
            input_type: cat.method,
            score_rule: `${cat.purpose ?? ""} ${cat.whenToRecord ?? ""}`.trim() || null,
            applies_to: mapped.join(", ").slice(0, 150) || null,
            subtype_keywords: null,
            display_order: order,
            purpose: cat.purpose,
            when_to_record: cat.whenToRecord,
            score_range: cat.range,
            risk_groups: cat.riskGroups,
            score_status: cat.status,
            score_reference: cat.reference,
            developer_note: cat.developerNote,
            auto_fill_percent: cat.autoFillPercent,
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

        // Replace this score's cancer-type links with the current map.
        const linkedTypes = mapped.length > 0 ? mapped : [primaryType];
        await prisma.cancer_score_cancer_types.deleteMany({ where: { score_id: scoreId } });
        for (const typeName of linkedTypes) {
            const typeId = typeByName.get(typeName);
            if (!typeId) continue;
            await prisma.cancer_score_cancer_types.create({
                data: { score_id: scoreId, cancer_type_id: typeId },
            });
        }
    }

    // Hide legacy generic scores (the broad SCST... rows) from the picker.
    const catalogueIds = [...catalogue.keys()];
    const hidden = await prisma.cancer_score.updateMany({
        where: { score_id: { notIn: catalogueIds } },
        data: { active_status: 0 },
    });

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

    await prisma.cancer_score_variable.updateMany({
        where: { score_id: { in: catalogueIds } },
        data: { active_status: 0 },
    });

    let varCount = 0;
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
                varCount++;
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

    await prisma.cancer_score_group.updateMany({
        where: { score_id: { in: catalogueIds } },
        data: { active_status: 0 },
    });

    let groupCount = 0;
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
                groupCount++;
            } catch (e: any) {
                console.error(`  group upsert failed ${scoreGroupId}:`, e.message);
            }
        }
    }

    const [sCount, vCount, gCount, lCount] = await Promise.all([
        prisma.cancer_score.count({ where: { active_status: 1 } }),
        prisma.cancer_score_variable.count({ where: { active_status: 1 } }),
        prisma.cancer_score_group.count({ where: { active_status: 1 } }),
        prisma.cancer_score_cancer_types.count(),
    ]);

    console.log(`  cancer_score: ${scoreAdded} added, ${scoreUpdated} refreshed, ${hidden.count} legacy hidden (${sCount} active)`);
    console.log(`  cancer_score_variable: ${varCount} active (${vCount} total)`);
    console.log(`  cancer_score_group: ${groupCount} active (${gCount} total)`);
    console.log(`  cancer_score_cancer_types: ${lCount} links`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
