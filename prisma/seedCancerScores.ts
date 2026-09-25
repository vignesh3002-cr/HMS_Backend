import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateId } from "../src/utils/idGenerator";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------------------------------------------------------------------------
// cancer_score master - Diagnosis tab "Score" dropdown.
// Source: EMR_Oncology_Master_Data_Spec.docx, Section 2 "Grade and Score
// Input Fields" (Mohammed Ismail, Clinical Pharmacist - Oncology).
//
// Not seeded here because the Diagnosis tab already covers them elsewhere:
//   - Nottingham Grade, FIGO Histologic Grade, WHO/ISUP Grade
//       -> cancer_grade_master (Grade field, seedConsultation.ts)
//   - TNM Stage, FIGO Stage
//       -> staging_reference (Cancer Stage / T / N / M fields)
//
// The spec's "Cancer Type" column is mapped onto cancer_types rows below.
// subtypeKeywords ("|"-separated, whole-word, case-insensitive) limit a score
// to matching Histopathology selections; omitted = shown for the whole type.
// ---------------------------------------------------------------------------

const HEME = ["Leukemia", "Lymphoma", "Myeloma"];
const AGGRESSIVE_NHL = "DLBCL|Burkitt|Mantle|T-cell|Anaplastic|Primary CNS";

type ScoreGroup = {
    appliesTo: string;
    cancerTypes: string[] | "ALL" | "SOLID";
    scoreSystem: string;
    inputType: string;
    rule: string;
    subtypeKeywords?: string;
    values: string[];
};

const SCORES: ScoreGroup[] = [
    // ---- Breast ----
    {
        appliesTo: "Breast",
        cancerTypes: ["Breast"],
        scoreSystem: "Ki-67 Proliferation Index",
        inputType: "Numeric %",
        rule: "0-100% (record exact value; low <10%, intermediate 10-20%, high >20% - cutoffs configurable)",
        values: ["Ki-67 Low (<10%)", "Ki-67 Intermediate (10-20%)", "Ki-67 High (>20%)"],
    },
    {
        appliesTo: "Breast",
        cancerTypes: ["Breast"],
        scoreSystem: "ER Status",
        inputType: "Numeric + Category",
        rule: "Allred Score 0-8 (Proportion 0-5 + Intensity 0-3), OR H-Score 0-300, OR % positive nuclei (0-100%); Category: Positive (>=1%) / Negative",
        values: [
            "ER Positive (>=1%)", "ER Negative (<1%)",
            ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => `ER Allred ${n}`),
        ],
    },
    {
        appliesTo: "Breast",
        cancerTypes: ["Breast"],
        scoreSystem: "PR Status",
        inputType: "Numeric + Category",
        rule: "Allred Score 0-8 (Proportion 0-5 + Intensity 0-3), OR H-Score 0-300, OR % positive nuclei (0-100%); Category: Positive (>=1%) / Negative",
        values: [
            "PR Positive (>=1%)", "PR Negative (<1%)",
            ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => `PR Allred ${n}`),
        ],
    },
    {
        appliesTo: "Breast",
        cancerTypes: ["Breast"],
        scoreSystem: "HER2 Status",
        inputType: "Dropdown + Numeric",
        rule: "IHC: 0 / 1+ / 2+(equivocal) / 3+; FISH/ISH ratio (numeric, positive if >=2.0); Final Status: Positive/Negative/Equivocal",
        values: [
            "HER2 IHC 0", "HER2 IHC 1+", "HER2 IHC 2+ (Equivocal)", "HER2 IHC 3+",
            "HER2 FISH/ISH Positive (ratio >=2.0)", "HER2 FISH/ISH Negative (ratio <2.0)",
            "HER2 Final: Positive", "HER2 Final: Negative", "HER2 Final: Equivocal",
        ],
    },

    // ---- Lymphoma ----
    {
        appliesTo: "Lymphoma (Hodgkin & NHL)",
        cancerTypes: ["Lymphoma"],
        scoreSystem: "Ann Arbor / Lugano Stage",
        inputType: "Dropdown",
        rule: "Stage I / II / III / IV; Modifier: A (no B-symptoms) / B (B-symptoms present); E (extranodal extension); Bulky disease flag",
        values: [
            "Ann Arbor Stage I", "Ann Arbor Stage II", "Ann Arbor Stage III", "Ann Arbor Stage IV",
            "Modifier A (no B-symptoms)", "Modifier B (B-symptoms present)",
            "E (extranodal extension)", "Bulky disease",
        ],
    },
    {
        appliesTo: "DLBCL / Aggressive NHL",
        cancerTypes: ["Lymphoma"],
        scoreSystem: "IPI Score",
        inputType: "Numeric (0-5) + Category",
        rule: "1 point each: Age >60, Stage III/IV, ECOG PS >=2, LDH elevated, >1 extranodal site; Risk: Low(0-1)/Low-Int(2)/High-Int(3)/High(4-5)",
        subtypeKeywords: AGGRESSIVE_NHL,
        values: [
            "IPI 0 - Low", "IPI 1 - Low", "IPI 2 - Low-Intermediate",
            "IPI 3 - High-Intermediate", "IPI 4 - High", "IPI 5 - High",
        ],
    },
    {
        appliesTo: "Follicular Lymphoma",
        cancerTypes: ["Lymphoma"],
        scoreSystem: "FLIPI Score",
        inputType: "Numeric (0-5) + Category",
        rule: "1 point each: Age >60, Stage III/IV, Hb <12g/dL, >4 nodal sites, LDH elevated; Risk: Low(0-1)/Int(2)/High(>=3)",
        subtypeKeywords: "Follicular",
        values: [
            "FLIPI 0 - Low", "FLIPI 1 - Low", "FLIPI 2 - Intermediate",
            "FLIPI 3 - High", "FLIPI 4 - High", "FLIPI 5 - High",
        ],
    },
    {
        appliesTo: "Aggressive NHL (post-Rituximab era)",
        cancerTypes: ["Lymphoma"],
        scoreSystem: "R-IPI (Revised IPI)",
        inputType: "Numeric (0-5) + Category",
        rule: "Same 5 factors as IPI; Risk: Very Good (0) / Good (1-2) / Poor (3-5)",
        subtypeKeywords: AGGRESSIVE_NHL,
        values: ["R-IPI Very Good (0)", "R-IPI Good (1-2)", "R-IPI Poor (3-5)"],
    },

    // ---- Leukemia (AML / ALL / CML / CLL / MDS) ----
    {
        appliesTo: "AML",
        cancerTypes: ["Leukemia"],
        scoreSystem: "ELN Risk Category",
        inputType: "Dropdown",
        rule: "Favorable / Intermediate / Adverse (per ELN 2022 cytogenetic + molecular criteria)",
        subtypeKeywords: "AML|APL",
        values: ["ELN Favorable", "ELN Intermediate", "ELN Adverse"],
    },
    {
        appliesTo: "AML/ALL/MDS/CML",
        cancerTypes: ["Leukemia"],
        scoreSystem: "Blast Percentage",
        inputType: "Numeric %",
        rule: "0-100% (Bone Marrow blasts, Peripheral Blood blasts - separate fields)",
        subtypeKeywords: "AML|APL|ALL|MDS|CML",
        values: ["Bone Marrow Blasts (0-100%)", "Peripheral Blood Blasts (0-100%)"],
    },
    {
        appliesTo: "CLL",
        cancerTypes: ["Leukemia"],
        scoreSystem: "Rai Stage",
        inputType: "Dropdown",
        rule: "Rai: 0/I/II/III/IV",
        subtypeKeywords: "CLL|SLL|Richter",
        values: ["Rai 0", "Rai I", "Rai II", "Rai III", "Rai IV"],
    },
    {
        appliesTo: "CLL",
        cancerTypes: ["Leukemia"],
        scoreSystem: "Binet Stage",
        inputType: "Dropdown",
        rule: "Binet: A/B/C",
        subtypeKeywords: "CLL|SLL|Richter",
        values: ["Binet A", "Binet B", "Binet C"],
    },
    {
        appliesTo: "CML (Chronic Phase, at diagnosis)",
        cancerTypes: ["Leukemia"],
        scoreSystem: "Sokal / Hasford (Euro) / EUTOS Score",
        inputType: "Numeric + Category",
        rule: "Each formula uses age, spleen size, platelet count, blast %(Sokal/Hasford add differential counts); Risk category: Low / Intermediate / High per chosen scoring system",
        subtypeKeywords: "CML",
        values: [
            "Sokal Low", "Sokal Intermediate", "Sokal High",
            "Hasford Low", "Hasford Intermediate", "Hasford High",
            "EUTOS Low", "EUTOS High",
        ],
    },
    {
        appliesTo: "MDS",
        cancerTypes: ["Leukemia"],
        scoreSystem: "IPSS-R",
        inputType: "Numeric + Category",
        rule: "Weighted sum of cytogenetic risk group, BM blast %, Hemoglobin, Platelet count, ANC; Risk: Very Low / Low / Intermediate / High / Very High",
        subtypeKeywords: "MDS",
        values: ["IPSS-R Very Low", "IPSS-R Low", "IPSS-R Intermediate", "IPSS-R High", "IPSS-R Very High"],
    },

    // ---- Multiple Myeloma ----
    {
        appliesTo: "Multiple Myeloma",
        cancerTypes: ["Myeloma"],
        scoreSystem: "ISS Stage",
        inputType: "Dropdown",
        rule: "ISS: I/II/III (based on Beta-2-microglobulin + Albumin)",
        values: ["ISS I", "ISS II", "ISS III"],
    },
    {
        appliesTo: "Multiple Myeloma",
        cancerTypes: ["Myeloma"],
        scoreSystem: "R-ISS Stage",
        inputType: "Dropdown",
        rule: "R-ISS: I/II/III (adds LDH + high-risk cytogenetics)",
        values: ["R-ISS I", "R-ISS II", "R-ISS III"],
    },
    {
        appliesTo: "Multiple Myeloma",
        cancerTypes: ["Myeloma"],
        scoreSystem: "mSMART Molecular Risk",
        inputType: "Dropdown",
        rule: "Standard Risk (default); High Risk if any of: t(4;14), t(14;16), t(14;20), del(17p), gain(1q)/amp(1q), or high LDH",
        values: ["mSMART Standard Risk", "mSMART High Risk"],
    },

    // ---- HSCT candidates ----
    {
        appliesTo: "Allogeneic/Autologous HSCT Candidates",
        cancerTypes: HEME,
        scoreSystem: "HCT-Comorbidity Index (HCT-CI)",
        inputType: "Numeric + Category",
        rule: "Weighted sum (0-1, 2-3 pts per comorbidity: cardiac, pulmonary, hepatic, renal, prior malignancy, infection, psychiatric, obesity, etc.); Risk: Low (0) / Intermediate (1-2) / High (>=3)",
        values: ["HCT-CI Low (0)", "HCT-CI Intermediate (1-2)", "HCT-CI High (>=3)"],
    },

    // ---- Solid tumours ----
    {
        appliesTo: "Solid Tumors on Imaging",
        cancerTypes: "SOLID",
        scoreSystem: "RECIST 1.1 Response",
        inputType: "Dropdown",
        rule: "Complete Response (CR) / Partial Response (PR) / Stable Disease (SD) / Progressive Disease (PD)",
        values: [
            "RECIST Complete Response (CR)", "RECIST Partial Response (PR)",
            "RECIST Stable Disease (SD)", "RECIST Progressive Disease (PD)",
        ],
    },

    // ---- All cancer types ----
    {
        appliesTo: "All Cancer Types",
        cancerTypes: "ALL",
        scoreSystem: "ECOG Performance Status",
        inputType: "Dropdown",
        rule: "0 (Fully active) / 1 / 2 / 3 / 4 (Completely disabled) / 5 (Dead)",
        values: ["ECOG 0 (Fully active)", "ECOG 1", "ECOG 2", "ECOG 3", "ECOG 4 (Completely disabled)", "ECOG 5 (Dead)"],
    },
    {
        appliesTo: "All Cancer Types",
        cancerTypes: "ALL",
        scoreSystem: "Karnofsky Performance Status",
        inputType: "Dropdown",
        rule: "100% down to 0%, in steps of 10",
        values: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((n) => `KPS ${n}%`),
    },
    {
        appliesTo: "All Cancer Types (Geriatric, age >=65)",
        cancerTypes: "ALL",
        scoreSystem: "G8 Screening Score",
        inputType: "Numeric (0-17) + Category",
        rule: "8-item screen: food intake, weight loss, mobility, neuropsych, BMI, >=3 medications, self-rated health, age - sum 0-17; Score <=14 = Abnormal (refer for full Geriatric Assessment); >14 = Normal",
        values: ["G8 <=14 - Abnormal (refer for full GA)", "G8 >14 - Normal"],
    },
    {
        appliesTo: "All Cancer Types (Geriatric, considering chemo)",
        cancerTypes: "ALL",
        scoreSystem: "CARG Toxicity Score",
        inputType: "Numeric (0-19/23) + Category",
        rule: "Cancer and Aging Research Group tool: sums weighted points across age, tumor/regimen type, hemoglobin, CrCl, hearing, falls, ADL/IADL limitations, social activity limitation; Risk: Low (0-3) / Intermediate (4-5) / High (>=6)",
        values: ["CARG Low (0-3)", "CARG Intermediate (4-5)", "CARG High (>=6)"],
    },
    {
        appliesTo: "All Cancer Patients (VTE risk, esp. before chemo/CVC)",
        cancerTypes: "ALL",
        scoreSystem: "Khorana Score",
        inputType: "Numeric (0-6) + Category",
        rule: "Points for cancer site (2 for very-high-risk sites, 1 for high-risk), platelet >=350k, Hb<10g/dL or ESA use, WBC>11k, BMI>=35 (1 pt each); Risk: Low (0) / Intermediate (1-2) / High (>=3)",
        values: ["Khorana Low (0)", "Khorana Intermediate (1-2)", "Khorana High (>=3)"],
    },
];

async function ensureSequence(entityName: string, prefix: string) {
    const existing = await prisma.id_sequences.findUnique({ where: { entity_name: entityName } });
    if (existing) return;
    await prisma.id_sequences.create({ data: { entity_name: entityName, prefix, current_number: 0 } });
    console.log(`[id_sequences] created ${entityName} with prefix ${prefix}`);
}

async function main() {
    console.log("=== Seeding cancer_score ===");
    await ensureSequence("CANCER_SCORE", "SCST");

    const types = await prisma.cancer_types.findMany({ where: { active_status: 1 } });
    const byName = new Map(types.map((type) => [type.cancer_type, type]));
    const allNames = types.map((type) => type.cancer_type);
    const solidNames = allNames.filter((name) => !HEME.includes(name));

    let added = 0;
    let updated = 0;

    for (const group of SCORES) {
        const names =
            group.cancerTypes === "ALL" ? allNames
                : group.cancerTypes === "SOLID" ? solidNames
                    : group.cancerTypes;

        for (const name of names) {
            const type = byName.get(name);
            if (!type || !type.cancer_type_id) {
                console.warn(`  skip ${group.scoreSystem} - unknown cancer_type "${name}"`);
                continue;
            }

            for (const [index, scoreValue] of group.values.entries()) {
                const details = {
                    input_type: group.inputType,
                    score_rule: group.rule,
                    applies_to: group.appliesTo,
                    subtype_keywords: group.subtypeKeywords ?? null,
                    display_order: index + 1,
                };
                const existing = await prisma.cancer_score.findFirst({
                    where: { cancer_type_id: type.cancer_type_id, score_system: group.scoreSystem, score_value: scoreValue },
                });
                if (existing) {
                    await prisma.cancer_score.update({
                        where: { score_id: existing.score_id },
                        data: { ...details, updated_at: new Date() },
                    });
                    updated++;
                    continue;
                }
                const scoreId = await prisma.$transaction((tx) => generateId(tx, "CANCER_SCORE"));
                await prisma.cancer_score.create({
                    data: {
                        score_id: scoreId,
                        cancer_type_id: type.cancer_type_id,
                        score_system: group.scoreSystem,
                        score_value: scoreValue,
                        ...details,
                    },
                });
                added++;
            }
        }
    }

    const count = await prisma.cancer_score.count();
    console.log(`  ${added} added, ${updated} refreshed - ${count} cancer_score rows ready`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
