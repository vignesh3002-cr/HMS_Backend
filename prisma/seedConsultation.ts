import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateId, generateIdBatch } from "../src/utils/idGenerator";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------------------------------------------------------------------------
// Consultation Summary + Diagnosis + Chemotherapy master data.
// Sources: EMR_Oncology_Master_Data_Spec.docx (Mohammed Ismail, Clinical
// Pharmacist - Oncology, GVN/Ramana Hospital Group) + standard clinical
// immunization / diet reference lists.
// ---------------------------------------------------------------------------

const IMMUNIZATIONS: { code: string; name: string; description?: string }[] = [
    { code: "IMM-BCG", name: "BCG", description: "Tuberculosis, at birth" },
    { code: "IMM-HEPB0", name: "Hepatitis B (Birth dose)", description: "Within 24h of birth" },
    { code: "IMM-OPV0", name: "OPV (Birth dose)", description: "Polio" },
    { code: "IMM-HEPB", name: "Hepatitis B", description: "Monovalent/pentavalent schedule" },
    { code: "IMM-DPT", name: "DPT", description: "Diphtheria, Pertussis, Tetanus" },
    { code: "IMM-OPV", name: "OPV", description: "Oral Polio Vaccine" },
    { code: "IMM-IPV", name: "IPV", description: "Inactivated Polio Vaccine" },
    { code: "IMM-PENTA", name: "Pentavalent", description: "DPT + HepB + Hib" },
    { code: "IMM-ROTA", name: "Rotavirus", description: "Oral" },
    { code: "IMM-PCV", name: "PCV (Pneumococcal)", description: "Pneumococcal Conjugate Vaccine" },
    { code: "IMM-MR", name: "MR / MMR", description: "Measles, Rubella / Mumps" },
    { code: "IMM-MMR", name: "MMR", description: "Measles, Mumps, Rubella" },
    { code: "IMM-VZ", name: "Varicella", description: "Chickenpox" },
    { code: "IMM-HEPA", name: "Hepatitis A", description: "Inactivated" },
    { code: "IMM-JE", name: "Japanese Encephalitis", description: "JE vaccine" },
    { code: "IMM-TYPHOID", name: "Typhoid", description: "Typhoid conjugate / Vi-PS" },
    { code: "IMM-TD", name: "Td / Tdap", description: "Tetanus, Diphtheria booster" },
    { code: "IMM-HPV", name: "HPV", description: "Human Papillomavirus; also standard in ovarian/cervical cancer" },
    { code: "IMM-FLU", name: "Influenza", description: "Seasonal influenza" },
    { code: "IMM-PPSV", name: "PPSV23 / PCV20", description: "Pneumococcal polysaccharide/conjugate" },
    { code: "IMM-COVID", name: "COVID-19", description: "SARS-CoV-2 vaccination" },
    { code: "IMM-ZOSTER", name: "Shingles (Zoster)", description: "Recombinant zoster vaccine" },
    { code: "IMM-RABIES", name: "Rabies (PEP)", description: "Post-exposure prophylaxis" },
    { code: "IMM-YELLOW", name: "Yellow Fever", description: "Travel/vertical exposure" },
];

const DRUG_CONSUMPTIONS: { code: string; name: string; description?: string }[] = [
    { code: "DRG-ALCOHOL", name: "Alcohol", description: "Any alcohol consumption" },
    { code: "DRG-SMOKING", name: "Smoking / Tobacco Smoking", description: "Cigarettes, bidi, cigar" },
    { code: "DRG-SMOKELESS", name: "Smokeless Tobacco", description: "Gutka, khaini, pan masala, snus" },
    { code: "DRG-PAN", name: "Pan / Betel Nut", description: "With or without tobacco" },
    { code: "DRG-NSAID", name: "NSAIDs / Analgesics", description: "Regular painkiller use" },
    { code: "DRG-STEROID", name: "Steroids", description: "Corticosteroid / anabolic use" },
    { code: "DRG-OPIOID", name: "Opioids", description: "Prescription/non-prescription opioids" },
    { code: "DRG-RECREATIONAL", name: "Recreational Drugs", description: "Cannabis, etc." },
    { code: "DRG-HERBAL", name: "Herbal / Traditional", description: "Ayurvedic, herbal supplements" },
];

const DIETS: string[] = [
    "Vegetarian",
    "Eggetarian",
    "Non-Vegetarian",
    "Vegan",
    "Jain",
    "Gluten-Free",
    "Diabetic",
    "Low-Salt",
];

// Document Section 1 - Site / Anatomical Location variants keyed by cancer
// type name (as configured in cancer_types).
const ANATOMICAL_SITES: { cancerType: string; category: string; sites: string[] }[] = [
    {
        cancerType: "Breast",
        category: "Quadrant / Location",
        sites: [
            "Upper Outer Quadrant",
            "Upper Inner Quadrant",
            "Lower Outer Quadrant",
            "Lower Inner Quadrant",
            "Central/Retroareolar",
            "Axillary Tail",
        ],
    },
    {
        cancerType: "Bladder",
        category: "Anatomical Location",
        sites: [
            "Trigone",
            "Dome",
            "Lateral Wall (L)",
            "Lateral Wall (R)",
            "Posterior Wall",
            "Anterior Wall",
            "Bladder Neck",
            "Ureteric Orifice involvement",
        ],
    },
    {
        cancerType: "Cervical",
        category: "Site",
        sites: ["Exocervix", "Endocervix", "Cervical Stump"],
    },
    {
        cancerType: "Upper Tract Urothelial",
        category: "Site",
        sites: ["Renal Pelvis", "Ureter (Upper third)", "Ureter (Mid third)", "Ureter (Lower third)"],
    },
    {
        cancerType: "Ovarian",
        category: "Site (per HGSC workup)",
        sites: ["Fallopian Tube", "Primary Peritoneal"],
    },
];

// Document Section 2 - Grade systems keyed by cancer type name.
const CANCER_GRADES: { cancerType: string; gradeSystem: string; grades: string[] }[] = [
    {
        cancerType: "Breast",
        gradeSystem: "Nottingham (Bloom-Richardson)",
        grades: ["Grade 1 (3-5 pts)", "Grade 2 (6-7 pts)", "Grade 3 (8-9 pts)"],
    },
    {
        cancerType: "Ovarian",
        gradeSystem: "FIGO Histologic Grade",
        grades: ["Grade 1 (<=5% solid)", "Grade 2 (6-50% solid)", "Grade 3 (>50% solid)"],
    },
    {
        cancerType: "Endometrial",
        gradeSystem: "FIGO Histologic Grade (Endometrioid)",
        grades: ["Grade 1 (<=5% solid)", "Grade 2 (6-50% solid)", "Grade 3 (>50% solid)"],
    },
    {
        cancerType: "Bladder",
        gradeSystem: "WHO/ISUP Grade",
        grades: ["Low Grade", "High Grade"],
    },
    {
        cancerType: "Bladder",
        gradeSystem: "WHO 1973 (legacy)",
        grades: ["Grade 1", "Grade 2", "Grade 3"],
    },
];

// Document Section 1 - granular histologic subtypes to enrich cancer_subtypes
// (merged only when the target cancer type exists and the name is not already
// configured for that type).
const SUBTYPE_ENRICHMENT: { cancerType: string; subtypes: { name: string; icd10?: string; morpho?: string }[] }[] = [
    {
        cancerType: "Breast",
        subtypes: [
            { name: "Mucinous carcinoma", morpho: "8480/3" },
            { name: "Tubular carcinoma", morpho: "8211/3" },
            { name: "Medullary carcinoma", morpho: "8510/3" },
            { name: "Papillary carcinoma", morpho: "8503/3" },
            { name: "Metaplastic carcinoma", morpho: "8575/3" },
            { name: "Mixed Ductal-Lobular", morpho: "8522/3" },
            { name: "DCIS (Ductal Carcinoma In Situ)", morpho: "8500/2" },
            { name: "Paget Disease of Nipple", morpho: "8540/3" },
            { name: "Inflammatory Carcinoma", morpho: "8530/3" },
        ],
    },
    {
        cancerType: "Ovarian",
        subtypes: [
            { name: "Low-grade Serous", morpho: "8460/3" },
            { name: "Mucinous", morpho: "8470/3" },
            { name: "Endometrioid", morpho: "8380/3" },
            { name: "Carcinosarcoma (MMMT)", morpho: "8950/3" },
            { name: "Germ Cell (Dysgerminoma/Yolk Sac/Immature Teratoma)", morpho: "9064/3" },
            { name: "Sex Cord-Stromal (Granulosa Cell/Sertoli-Leydig)", morpho: "8620/1" },
            { name: "Borderline Tumor", morpho: "8442/1" },
        ],
    },
    {
        cancerType: "Cervical",
        subtypes: [
            { name: "Squamous Cell Carcinoma (Keratinizing)", morpho: "8070/3" },
            { name: "Squamous Cell Carcinoma (Non-keratinizing)", morpho: "8072/3" },
            { name: "Adenocarcinoma (Usual)", morpho: "8140/3" },
            { name: "Adenocarcinoma (Mucinous)", morpho: "8480/3" },
            { name: "Adenocarcinoma (Gastric-type)", morpho: "8145/3" },
            { name: "Adenosquamous", morpho: "8560/3" },
            { name: "Neuroendocrine / Small Cell", morpho: "8041/3" },
            { name: "Clear Cell", morpho: "8310/3" },
        ],
    },
    {
        cancerType: "Endometrial",
        subtypes: [
            { name: "Endometrioid (Type I)", morpho: "8380/3" },
            { name: "Serous (Type II)", morpho: "8441/3" },
            { name: "Clear Cell", morpho: "8310/3" },
            { name: "Carcinosarcoma", morpho: "8950/3" },
            { name: "Mucinous", morpho: "8480/3" },
            { name: "Undifferentiated / Dedifferentiated", morpho: "8020/3" },
            { name: "Mixed", morpho: "8383/3" },
        ],
    },
    {
        cancerType: "Bladder",
        subtypes: [
            { name: "Urothelial (Transitional Cell) Carcinoma", morpho: "8120/3" },
            { name: "Squamous Cell Carcinoma", morpho: "8070/3" },
            { name: "Adenocarcinoma (incl. Urachal)", morpho: "8140/3" },
            { name: "Small Cell / Neuroendocrine", morpho: "8041/3" },
            { name: "Sarcomatoid", morpho: "8122/3" },
            { name: "Micropapillary", morpho: "8131/3" },
            { name: "Nested variant", morpho: "8120/3" },
            { name: "Plasmacytoid variant", morpho: "8120/3" },
        ],
    },
    {
        cancerType: "Leukemia",
        subtypes: [
            { name: "AML - M0 (Undifferentiated)", morpho: "9805/3" },
            { name: "AML - M1 (Myeloblastic w/o maturation)", morpho: "9872/3" },
            { name: "AML - M2 (Myeloblastic w/ maturation)", morpho: "9873/3" },
            { name: "AML - M3 (APL)", morpho: "9866/3" },
            { name: "AML - M4 (Myelomonocytic)", morpho: "9867/3" },
            { name: "AML - M4eo (with eosinophilia)", morpho: "9871/3" },
            { name: "AML - M5 (Monocytic)", morpho: "9891/3" },
            { name: "AML - M6 (Erythroleukemia)", morpho: "9840/3" },
            { name: "AML - M7 (Megakaryoblastic)", morpho: "9910/3" },
            { name: "AML with t(8;21)", morpho: "9896/3" },
            { name: "AML with inv(16)/t(16;16)", morpho: "9871/3" },
            { name: "APL with PML-RARA", morpho: "9866/3" },
            { name: "AML with NPM1 mutation", morpho: "9861/3" },
            { name: "AML with CEBPA mutation", morpho: "9861/3" },
            { name: "AML with MLL/KMT2A rearrangement", morpho: "9861/3" },
            { name: "AML with myelodysplasia-related changes", morpho: "9895/3" },
            { name: "Therapy-related AML", morpho: "9920/3" },
            { name: "B-ALL (Precursor B)", morpho: "9836/3" },
            { name: "T-ALL (Precursor T)", morpho: "9837/3" },
            { name: "ALL Philadelphia chromosome-positive (BCR-ABL1+)", morpho: "9835/3" },
            { name: "Philadelphia-like ALL", morpho: "9835/3" },
            { name: "Burkitt Leukemia / Mature B-ALL", morpho: "9826/3" },
            { name: "CML - Chronic Phase", morpho: "9863/3" },
            { name: "CML - Accelerated Phase", morpho: "9863/3" },
            { name: "CML - Blast Phase (Myeloid/Lymphoid)", morpho: "9863/3" },
            { name: "CLL (leukemic)", morpho: "9823/3" },
            { name: "SLL (nodal)", morpho: "9670/3" },
            { name: "Richter Transformation", morpho: "9680/3" },
            { name: "MDS with single lineage dysplasia", morpho: "9980/3" },
            { name: "MDS with multilineage dysplasia", morpho: "9985/3" },
            { name: "MDS with ring sideroblasts", morpho: "9982/3" },
            { name: "MDS with excess blasts (1/2)", morpho: "9983/3" },
            { name: "MDS with isolated del(5q)", morpho: "9986/3" },
        ],
    },
    {
        cancerType: "Lymphoma",
        subtypes: [
            { name: "Hodgkin - Nodular Sclerosis", morpho: "9663/3" },
            { name: "Hodgkin - Mixed Cellularity", morpho: "9652/3" },
            { name: "Hodgkin - Lymphocyte-Rich", morpho: "9651/3" },
            { name: "Hodgkin - Lymphocyte-Depleted", morpho: "9653/3" },
            { name: "Hodgkin - Nodular Lymphocyte-Predominant (NLPHL)", morpho: "9659/3" },
            { name: "NHL - DLBCL (GCB / Non-GCB-ABC by Hans)", morpho: "9680/3" },
            { name: "NHL - Follicular Lymphoma (Grade 1-3A/3B)", morpho: "9690/3" },
            { name: "NHL - Mantle Cell Lymphoma", morpho: "9673/3" },
            { name: "NHL - Marginal Zone (MALT/Nodal/Splenic)", morpho: "9699/3" },
            { name: "NHL - Burkitt Lymphoma", morpho: "9687/3" },
            { name: "NHL - Small Lymphocytic Lymphoma", morpho: "9670/3" },
            { name: "NHL - Primary CNS Lymphoma", morpho: "9680/3" },
            { name: "NHL - Peripheral T-cell Lymphoma NOS", morpho: "9702/3" },
            { name: "NHL - Angioimmunoblastic T-cell Lymphoma", morpho: "9705/3" },
            { name: "NHL - Anaplastic Large Cell Lymphoma (ALK+/ALK-)", morpho: "9714/3" },
            { name: "NHL - Cutaneous T-cell Lymphoma (MF/Sezary)", morpho: "9700/3" },
        ],
    },
    {
        cancerType: "Myeloma",
        subtypes: [
            { name: "IgG", morpho: "9732/3" },
            { name: "IgA", morpho: "9732/3" },
            { name: "IgD", morpho: "9732/3" },
            { name: "IgM (rare)", morpho: "9732/3" },
            { name: "Light Chain Only (Kappa/Lambda)", morpho: "9733/3" },
            { name: "Non-secretory", morpho: "9732/3" },
            { name: "Plasma Cell Leukemia", morpho: "9733/3" },
            { name: "Solitary Plasmacytoma (bone/extramedullary)", morpho: "9731/3" },
        ],
    },
];

// Document Section 1 - endometrial TCGA/ProMisE molecular classes.
const ENDOMETRIAL_MOLECULAR: { subtype_name: string; badge_label: string }[] = [
    { subtype_name: "POLE-mutated (ultramutated)", badge_label: "POLE-mut" },
    { subtype_name: "Mismatch Repair-deficient (MMR-d)", badge_label: "MMR-d" },
    { subtype_name: "p53-abnormal (Copy Number-high)", badge_label: "p53-abn" },
    { subtype_name: "No Specific Molecular Profile (NSMP)", badge_label: "NSMP" },
];

// Breast PAM50 surrogate (mirrors seedOncology rows; kept here so the
// molecular_subtypes table is complete against its chk_molsub_name check).
const BREAST_MOLECULAR: { subtype_name: string; er_rule: string; pr_rule: string; her2_rule: string; ki67_threshold: number; colour_hex: string; badge_label: string }[] = [
    { subtype_name: "Luminal A", er_rule: "Positive", pr_rule: "Any", her2_rule: "Negative", ki67_threshold: 14, colour_hex: "#4CAF50", badge_label: "Luminal A" },
    { subtype_name: "Luminal B HER2-", er_rule: "Positive", pr_rule: "Any", her2_rule: "Negative", ki67_threshold: 14, colour_hex: "#FFC107", badge_label: "Luminal B HER2-" },
    { subtype_name: "Luminal B HER2+", er_rule: "Positive", pr_rule: "Any", her2_rule: "Positive", ki67_threshold: 14, colour_hex: "#FF9800", badge_label: "Luminal B HER2+" },
    { subtype_name: "HER2-Enriched", er_rule: "Negative", pr_rule: "Negative", her2_rule: "Positive", ki67_threshold: 14, colour_hex: "#9C27B0", badge_label: "HER2-Enriched" },
    { subtype_name: "TNBC", er_rule: "Negative", pr_rule: "Negative", her2_rule: "Negative", ki67_threshold: 14, colour_hex: "#F44336", badge_label: "TNBC" },
];

// Document Section 3 - Hydration values by chemotherapy protocol. Attached to
// existing protocol items (and their protocol) whose medicine matches one of
// these agents, with hydration_stage PRE/POST so the Chemotherapy Orders
// Hydration tab can display them.
const HYDRATION_GUIDANCE: {
    medicineMatch: string;
    stage: "PRE" | "POST";
    diluent: string;
    dilution_volume: string;
    comment: string;
}[] = [
    {
        medicineMatch: "cisplatin",
        stage: "PRE",
        diluent: "NS 0.9%",
        dilution_volume: "1000-2000",
        comment: "Over 2-4h pre-chemo, with KCl 20mEq/L + MgSO4 1-2g. Maintain urine output >=100mL/hr; monitor strict I/O. (>=50mg/m2 doses.)",
    },
    {
        medicineMatch: "cisplatin",
        stage: "POST",
        diluent: "NS 0.9%",
        dilution_volume: "1000-2000",
        comment: "Over 2-4h post-chemo, +/- Mannitol 12.5-25g or Furosemide for forced diuresis. (>=50mg/m2 doses.)",
    },
    {
        medicineMatch: "carboplatin",
        stage: "PRE",
        diluent: "NS 0.9%",
        dilution_volume: "250-500",
        comment: "Not mandatory; routine pre-chemo hydration per institutional practice. Dose via Calvert formula (AUC, see Section 4).",
    },
    {
        medicineMatch: "ifosfamide",
        stage: "PRE",
        diluent: "NS / D5NS",
        dilution_volume: "1000-2000",
        comment: "Over 1-2h pre-infusion. MUST co-administer MESNA (uroprotection); monitor for hemorrhagic cystitis, encephalopathy.",
    },
    {
        medicineMatch: "ifosfamide",
        stage: "POST",
        diluent: "NS / D5NS",
        dilution_volume: "100-150 /hr",
        comment: "Continue IV fluids at 100-150mL/hr during and 12-24h post-infusion.",
    },
    {
        medicineMatch: "cyclophosphamide",
        stage: "PRE",
        diluent: "NS 0.9%",
        dilution_volume: "500-1000",
        comment: "Pre-infusion hydration. MESNA required if high-dose Cyclophosphamide (>=1g/m2).",
    },
    {
        medicineMatch: "cyclophosphamide",
        stage: "POST",
        diluent: "NS 0.9%",
        dilution_volume: "maintain UOP",
        comment: "IV fluids to maintain adequate urine output through infusion.",
    },
    {
        medicineMatch: "methotrexate",
        stage: "PRE",
        diluent: "D5W + NaHCO3",
        dilution_volume: "start 12h prior",
        comment: "High-dose MTX (>=500mg/m2): IV hydration + alkalinization started 12h prior, target urine pH >=7.0, UOP >=100mL/hr.",
    },
    {
        medicineMatch: "methotrexate",
        stage: "POST",
        diluent: "D5W + NaHCO3",
        dilution_volume: "continue until MTX <0.1",
        comment: "Continue hydration + alkalinization until MTX level <0.1 micromol/L. Leucovorin rescue mandatory per nomogram; monitor MTX levels, renal function, urine pH q6h.",
    },
    {
        medicineMatch: "pemetrexed",
        stage: "PRE",
        diluent: "-",
        dilution_volume: "0",
        comment: "No mandatory hydration. Requires Vitamin B12 + Folic Acid supplementation (mandatory co-medication).",
    },
    {
        medicineMatch: "cytarabine",
        stage: "PRE",
        diluent: "NS 0.9%",
        dilution_volume: "maintenance",
        comment: "HiDAC: standard IV maintenance fluids. Not nephrotoxic; hydration per general supportive care, not protocol-mandated.",
    },
    {
        medicineMatch: "doxorubicin",
        stage: "PRE",
        diluent: "-",
        dilution_volume: "0",
        comment: "No mandatory hydration. Cardiac monitoring (cumulative dose tracking) is the key safety field.",
    },
];

// Document Section 4 - weight-based dosing basis flags per drug (mg/kg).
const DOSING_BASIS: { medicineMatch: string; dosingBasis: string }[] = [
    { medicineMatch: "bevacizumab", dosingBasis: "Weight (mg/kg)" },
    { medicineMatch: "trastuzumab", dosingBasis: "Weight (mg/kg)" },
    { medicineMatch: "nivolumab", dosingBasis: "Weight (mg/kg)" },
    { medicineMatch: "ipilimumab", dosingBasis: "Weight (mg/kg)" },
    { medicineMatch: "pembrolizumab", dosingBasis: "Weight (mg/kg)" },
    { medicineMatch: "filgrastim", dosingBasis: "Weight (mg/kg)" },
    { medicineMatch: "enoxaparin", dosingBasis: "Weight (mg/kg)" },
    { medicineMatch: "vincristine", dosingBasis: "Weight (mg/kg) below 10kg" },
];

async function ensureSequence(entityName: string, prefix: string) {
    const existing = await prisma.id_sequences.findUnique({ where: { entity_name: entityName } });
    if (existing) {
        if (existing.prefix !== prefix) {
            await prisma.id_sequences.update({ where: { entity_name: entityName }, data: { prefix } });
            console.log(`[id_sequences] ${entityName} prefix updated to ${prefix}`);
        }
        return;
    }
    await prisma.id_sequences.create({ data: { entity_name: entityName, prefix, current_number: 0 } });
    console.log(`[id_sequences] created ${entityName} with prefix ${prefix}`);
}

async function seedMasterList<T extends { code: string; name: string; description?: string }>(
    model: "immunization_master" | "drug_consumption_master" | "symptom_master",
    rows: T[],
    nameColumn: "name" | "substance_name"
) {
    for (const row of rows) {
        const existing: any = await (prisma as any)[model].findUnique({ where: { code: row.code } });
        const data = { description: row.description };
        if (existing) {
            await (prisma as any)[model].update({ where: { code: row.code }, data });
        } else {
            await (prisma as any)[model].create({ data: { ...row } });
        }
    }
    console.log(`  ${rows.length} ${model} rows ready`);
}

async function seedAnatomicalSites() {
    console.log("Seeding anatomical_site_master...");
    for (const group of ANATOMICAL_SITES) {
        const type = await prisma.cancer_types.findFirst({ where: { cancer_type: group.cancerType } });
        if (!type || !type.cancer_type_id) {
            console.warn(`  skip sites - unknown cancer_type "${group.cancerType}"`);
            continue;
        }
        for (const siteName of group.sites) {
            const existing = await prisma.anatomical_site_master.findFirst({
                where: { cancer_type_id: type.cancer_type_id, site_name: siteName },
            });
            if (existing) continue;
            const siteId = await prisma.$transaction((tx) => generateId(tx, "ANATOMICAL_SITE"));
            await prisma.anatomical_site_master.create({
                data: { site_id: siteId, cancer_type_id: type.cancer_type_id, site_name: siteName, site_category: group.category },
            });
        }
    }
    const count = await prisma.anatomical_site_master.count();
    console.log(`  ${count} anatomical_site_master rows ready`);
}

async function seedCancerGrades() {
    console.log("Seeding cancer_grade_master...");
    for (const group of CANCER_GRADES) {
        const type = await prisma.cancer_types.findFirst({ where: { cancer_type: group.cancerType } });
        if (!type || !type.cancer_type_id) {
            console.warn(`  skip grades - unknown cancer_type "${group.cancerType}"`);
            continue;
        }
        for (const gradeValue of group.grades) {
            const existing = await prisma.cancer_grade_master.findFirst({
                where: { cancer_type_id: type.cancer_type_id, grade_system: group.gradeSystem, grade_value: gradeValue },
            });
            if (existing) continue;
            const gradeId = await prisma.$transaction((tx) => generateId(tx, "CANCER_GRADE"));
            await prisma.cancer_grade_master.create({
                data: { grade_id: gradeId, cancer_type_id: type.cancer_type_id, grade_system: group.gradeSystem, grade_value: gradeValue },
            });
        }
    }
    const count = await prisma.cancer_grade_master.count();
    console.log(`  ${count} cancer_grade_master rows ready`);
}

async function enrichCancerSubtypes() {
    console.log("Enriching cancer_subtypes from document Section 1...");
    let added = 0;
    for (const group of SUBTYPE_ENRICHMENT) {
        const type = await prisma.cancer_types.findFirst({ where: { cancer_type: group.cancerType } });
        if (!type || !type.cancer_type_id) {
            console.warn(`  skip subtypes - unknown cancer_type "${group.cancerType}"`);
            continue;
        }
        for (const subtype of group.subtypes) {
            const existing = await prisma.cancer_subtypes.findFirst({
                where: { cancer_type_id: type.cancer_type_id, subtype_name: subtype.name },
            });
            if (existing) continue;
            const subtypeId = await prisma.$transaction((tx) => generateId(tx, "CANCER_SUBTYPE"));
            await prisma.cancer_subtypes.create({
                data: {
                    subtype_id: subtypeId,
                    cancer_type_id: type.cancer_type_id,
                    subtype_name: subtype.name,
                    icd_o3_morphology: subtype.morpho ?? null,
                    icd10_subtype: subtype.icd10 ?? null,
                },
            });
            added++;
        }
    }
    console.log(`  ${added} cancer_subtypes added`);
}

async function seedMolecularSubtypes() {
    console.log("Seeding breast PAM50 + endometrial TCGA/ProMisE molecular_subtypes...");

    const breastType = await prisma.cancer_types.findFirst({ where: { cancer_type: "Breast" } });
    if (breastType?.cancer_type_id) {
        for (const row of BREAST_MOLECULAR) {
            const existing = await prisma.molecular_subtypes.findFirst({
                where: { cancer_type_id: breastType.cancer_type_id, subtype_name: row.subtype_name },
            });
            if (existing) {
                await prisma.molecular_subtypes.update({
                    where: { id: existing.id },
                    data: { er_rule: row.er_rule, pr_rule: row.pr_rule, her2_rule: row.her2_rule, ki67_threshold: row.ki67_threshold, colour_hex: row.colour_hex, badge_label: row.badge_label },
                });
                continue;
            }
            const molSubId = await prisma.$transaction((tx) => generateId(tx, "MOLECULAR_SUBTYPE"));
            await prisma.molecular_subtypes.create({
                data: { mol_sub_id: molSubId, cancer_type_id: breastType.cancer_type_id, ...row },
            });
        }
        console.log(`  ${BREAST_MOLECULAR.length} breast molecular_subtypes ready`);
    }

    const type = await prisma.cancer_types.findFirst({ where: { cancer_type: "Endometrial" } });
    if (!type || !type.cancer_type_id) {
        console.warn("  skip endometrial - unknown cancer_type 'Endometrial'");
        return;
    }
    for (const row of ENDOMETRIAL_MOLECULAR) {
        const existing = await prisma.molecular_subtypes.findFirst({
            where: { cancer_type_id: type.cancer_type_id, subtype_name: row.subtype_name },
        });
        if (existing) continue;
        const molSubId = await prisma.$transaction((tx) => generateId(tx, "MOLECULAR_SUBTYPE"));
        await prisma.molecular_subtypes.create({
            data: { mol_sub_id: molSubId, cancer_type_id: type.cancer_type_id, subtype_name: row.subtype_name, badge_label: row.badge_label },
        });
    }
    console.log(`  ${ENDOMETRIAL_MOLECULAR.length} endometrial molecular_subtypes ready`);
}

async function seedHydrationRows() {
    console.log("Seeding chemotherapy_protocol_dilutions hydration rows...");
    const medicines = await prisma.medicine_master.findMany({
        select: { medicine_id: true, medicine_name: true },
    });
    const matchedIds = medicines
        .filter((m) => HYDRATION_GUIDANCE.some((r) => (m.medicine_name ?? "").toLowerCase().includes(r.medicineMatch)))
        .map((m) => m.medicine_id);

    const items = await prisma.chemotherapy_regimen_protocol_items.findMany({
        where: { medicine_id: { in: matchedIds }, active_status: 1 },
        select: { protocol_item_id: true, protocol_id: true, medicine_id: true },
    });

    // One consolidated hydration row per (protocol, medicine, stage), with
    // representative protocol_item_id so the UI can group them per regimen.
    const combos = new Map<string, { protocol_id: string; protocol_item_id: string; medicine_id: string; rule: (typeof HYDRATION_GUIDANCE)[number] }>();
    for (const item of items) {
        const med = medicines.find((m) => m.medicine_id === item.medicine_id);
        if (!med) continue;
        const lower = (med.medicine_name ?? "").toLowerCase();
        for (const rule of HYDRATION_GUIDANCE) {
            if (!lower.includes(rule.medicineMatch)) continue;
            const key = `${item.protocol_id}|${item.medicine_id}|${rule.stage}|${rule.diluent}`;
            if (!combos.has(key)) combos.set(key, { protocol_id: item.protocol_id, protocol_item_id: item.protocol_item_id, medicine_id: item.medicine_id, rule });
        }
    }

    const existing = await prisma.chemotherapy_protocol_dilutions.findMany({
        where: {
            protocol_id: { in: [...new Set(items.map((i) => i.protocol_id))] },
            hydration_stage: { in: ["PRE", "POST"] },
        },
        select: { protocol_id: true, protocol_item_id: true, medicine_id: true, hydration_stage: true, diluent: true },
    });
    const existingKeys = new Set(
        existing.map((e) => `${e.protocol_id}|${e.medicine_id}|${e.hydration_stage}|${e.diluent}`)
    );

    const toCreate = [...combos.values()].filter((c) => !existingKeys.has(`${c.protocol_id}|${c.medicine_id}|${c.rule.stage}|${c.rule.diluent}`));
    if (toCreate.length === 0) {
        console.log(`  all hydration rows already present (${combos.size} combos)`);
        return;
    }

    const ids = await prisma.$transaction(
        (tx) => generateIdBatch(tx, "REGIMEN_PROTOCOL_DILUTION", toCreate.length),
        { timeout: 120000 }
    );

    await prisma.chemotherapy_protocol_dilutions.createMany({
        data: toCreate.map((c, i) => {
            const volumeText = c.rule.dilution_volume.replace(/[^0-9.]/g, "");
            return {
                protocol_dilution_id: ids[i],
                protocol_id: c.protocol_id,
                protocol_item_id: c.protocol_item_id,
                medicine_id: c.medicine_id,
                form: "Hydration",
                dilution_volume: volumeText ? Number(volumeText) : null,
                dilution_volume_unit: "mL",
                diluent: c.rule.diluent,
                hydration_stage: c.rule.stage,
                comment: c.rule.comment,
                active_status: 1,
            };
        }),
    });
    console.log(`  ${toCreate.length} hydration rows added`);
}

async function seedDosingBasis() {
    console.log("Updating dosing_basis by medicine (document Section 4)...");
    const medicines = await prisma.medicine_master.findMany({ select: { medicine_id: true, medicine_name: true } });
    const matchedIds = new Set<string>();
    for (const med of medicines) {
        const lower = (med.medicine_name ?? "").toLowerCase();
        if (DOSING_BASIS.some((r) => lower.includes(r.medicineMatch))) {
            matchedIds.add(med.medicine_id);
        }
    }
    const updated = await prisma.chemotherapy_regimen_protocol_items.updateMany({
        where: { medicine_id: { in: [...matchedIds] }, active_status: 1 },
        data: { dosing_basis: "Weight (mg/kg)" },
    });
    console.log(`  dosing_basis set on ${updated.count} protocol item(s)`);
}

async function main() {
    console.log("=== Seeding Consultation / Diagnosis / Chemotherapy masters ===");

    await ensureSequence("ENCOUNTER_REPORT", "ERPT");
    await ensureSequence("PERSONAL_HISTORY", "PHST");
    await ensureSequence("ANATOMICAL_SITE", "ANST");
    await ensureSequence("CANCER_GRADE", "GRST");

    console.log("Seeding immunization_master...");
    await seedMasterList("immunization_master", IMMUNIZATIONS, "name");
    console.log("Seeding drug_consumption_master...");
    await seedMasterList("drug_consumption_master", DRUG_CONSUMPTIONS, "name");

    await seedAnatomicalSites();
    await seedCancerGrades();
    await enrichCancerSubtypes();
    await seedMolecularSubtypes();
    await seedHydrationRows();
    await seedDosingBasis();

    console.log("Consultation master-data seeding complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());