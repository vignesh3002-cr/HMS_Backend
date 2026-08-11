import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateId } from "../src/utils/idGenerator";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------------------------------------------------------------------------
// Sheet 1 - Cancer Reference. One row per subtype (33 rows); cancer_types is
// derived from this same array by grouping on cancer_type name, so there is
// exactly one place to edit if the source sheet is revised.
// ---------------------------------------------------------------------------
interface CancerReferenceRow {
    cancer_type: string;
    icd10: string;
    icd_o3_topography: string;
    subtype_name: string;
    icd_o3_morphology: string;
    staging_system: string;
    druggable_targets: string;
}

const CANCER_REFERENCE: CancerReferenceRow[] = [
    { cancer_type: "Breast", icd10: "C50.9", icd_o3_topography: "C50.9", subtype_name: "IDC (NST) - Luminal A", icd_o3_morphology: "8500/3", staging_system: "AJCC TNM 8th", druggable_targets: "ESR1, CDK4/6, PIK3CA" },
    { cancer_type: "Breast", icd10: "C50.9", icd_o3_topography: "C50.9", subtype_name: "IDC (NST) - Luminal B (HER2-)", icd_o3_morphology: "8500/3", staging_system: "AJCC TNM 8th", druggable_targets: "CDK4/6, PIK3CA, mTOR, AKT1" },
    { cancer_type: "Breast", icd10: "C50.9", icd_o3_topography: "C50.9", subtype_name: "IDC (NST) - Luminal B (HER2+)", icd_o3_morphology: "8500/3", staging_system: "AJCC TNM 8th", druggable_targets: "HER2 (ERBB2), ESR1, CDK4/6" },
    { cancer_type: "Breast", icd10: "C50.9", icd_o3_topography: "C50.9", subtype_name: "IDC (NST) - HER2-enriched", icd_o3_morphology: "8500/3", staging_system: "AJCC TNM 8th", druggable_targets: "HER2 (ERBB2), PIK3CA" },
    { cancer_type: "Breast", icd10: "C50.9", icd_o3_topography: "C50.9", subtype_name: "IDC (NST) - TNBC", icd_o3_morphology: "8500/3", staging_system: "AJCC TNM 8th", druggable_targets: "PD-L1, BRCA1/2, HER2-ultralow, NTRK, TROP2, AKT" },
    { cancer_type: "Breast", icd10: "C50.9", icd_o3_topography: "C50.9", subtype_name: "Invasive lobular (ILC)", icd_o3_morphology: "8520/3", staging_system: "AJCC TNM 8th", druggable_targets: "ESR1, CDK4/6, FGFR (emerging)" },

    { cancer_type: "Lung", icd10: "C34.9", icd_o3_topography: "C34.1-3", subtype_name: "Adenocarcinoma", icd_o3_morphology: "8140/3", staging_system: "AJCC TNM 8th", druggable_targets: "EGFR, ALK, ROS1, KRAS G12C, MET, RET, NTRK, HER2, BRAF" },
    { cancer_type: "Lung", icd10: "C34.9", icd_o3_topography: "C34.1-3", subtype_name: "Squamous cell carcinoma", icd_o3_morphology: "8070/3", staging_system: "AJCC TNM 8th", druggable_targets: "PD-L1, FGFR1 (emerging)" },
    { cancer_type: "Lung", icd10: "C34.9", icd_o3_topography: "C34.1-3", subtype_name: "Small cell (SCLC)", icd_o3_morphology: "8041/3", staging_system: "VALSG Ltd/Ext + AJCC TNM", druggable_targets: "DLL3, TROP2, LSD1 (subtype-specific)" },

    { cancer_type: "Colorectal", icd10: "C18.9 / C20", icd_o3_topography: "C18.9", subtype_name: "Adenocarcinoma", icd_o3_morphology: "8140/3", staging_system: "AJCC TNM 8th", druggable_targets: "EGFR (RAS/RAF wt), VEGF, HER2, PD-1 (MSI-H), BRAF V600E" },

    { cancer_type: "Prostate", icd10: "C61", icd_o3_topography: "C61.9", subtype_name: "Acinar adenocarcinoma", icd_o3_morphology: "8140/3", staging_system: "AJCC TNM 8th + Gleason/ISUP Grade", druggable_targets: "AR, PARP (HRD), PD-1 (MSI-H), PSMA" },

    { cancer_type: "Gastric / GEJ", icd10: "C16.9", icd_o3_topography: "C16.9", subtype_name: "Adenocarcinoma", icd_o3_morphology: "8140/3", staging_system: "AJCC TNM 8th", druggable_targets: "HER2, VEGFR2, PD-1, FGFR2b, MET, CLDN18.2, NTRK" },

    { cancer_type: "Pancreatic", icd10: "C25.9", icd_o3_topography: "C25.9", subtype_name: "Ductal adenocarcinoma (PDAC)", icd_o3_morphology: "8500/3", staging_system: "AJCC TNM 8th", druggable_targets: "KRAS G12C, PARP (HRD), NTRK, RET (emerging)" },

    { cancer_type: "Liver", icd10: "C22.0", icd_o3_topography: "C22.0", subtype_name: "Hepatocellular carcinoma (HCC)", icd_o3_morphology: "8170/3", staging_system: "BCLC + AJCC TNM 8th", druggable_targets: "VEGF/VEGFR, PD-1/PD-L1, MET, FGF19-FGFR4" },

    { cancer_type: "Ovarian", icd10: "C56", icd_o3_topography: "C56.9", subtype_name: "High-grade serous (HGSOC)", icd_o3_morphology: "8461/3", staging_system: "FIGO 2014 + AJCC TNM", druggable_targets: "PARP (HRD/BRCA), VEGF, PD-L1, FR-alpha" },
    { cancer_type: "Ovarian", icd10: "C56", icd_o3_topography: "C56.9", subtype_name: "Clear cell / Endometrioid", icd_o3_morphology: "8310/3; 8380/3", staging_system: "FIGO 2014 + AJCC TNM", druggable_targets: "PI3K/mTOR, PD-1 (MSI-H), PARP (HRD subset)" },

    { cancer_type: "Endometrial", icd10: "C54.1", icd_o3_topography: "C54.1", subtype_name: "Endometrioid / Serous", icd_o3_morphology: "8380/3; 8441/3", staging_system: "FIGO 2023 + AJCC TNM", druggable_targets: "PD-1 (MMR-d), PARP (emerging), HER2 (serous), mTOR" },

    { cancer_type: "Cervical", icd10: "C53.9", icd_o3_topography: "C53.9", subtype_name: "Squamous / Adenocarcinoma", icd_o3_morphology: "8070/3; 8140/3", staging_system: "FIGO 2018 + AJCC TNM", druggable_targets: "PD-1/PD-L1, VEGF, HER2 (emerging)" },

    { cancer_type: "Bladder", icd10: "C67.9", icd_o3_topography: "C67.9", subtype_name: "Urothelial carcinoma", icd_o3_morphology: "8120/3", staging_system: "AJCC TNM 8th", druggable_targets: "FGFR3, PD-1/PD-L1, HER2, TROP2, VEGFR" },

    { cancer_type: "Kidney", icd10: "C64.9", icd_o3_topography: "C64.9", subtype_name: "Clear cell RCC", icd_o3_morphology: "8310/3", staging_system: "AJCC TNM 8th + WHO/ISUP Grade", druggable_targets: "VEGF/VEGFR, mTOR, PD-1/PD-L1, HIF2a (Belzutifan)" },

    { cancer_type: "Thyroid", icd10: "C73", icd_o3_topography: "C73.9", subtype_name: "Papillary / Follicular / ATC", icd_o3_morphology: "8260/3; 8330/3; 8020/3", staging_system: "AJCC TNM 8th (age-stratified)", druggable_targets: "BRAF V600E, NTRK, RET, ALK (esp. ATC/RAI-refractory)" },

    { cancer_type: "Melanoma", icd10: "C43.9", icd_o3_topography: "C43.9", subtype_name: "Cutaneous / Uveal / Mucosal", icd_o3_morphology: "8720/3", staging_system: "AJCC TNM 8th (Breslow/ulceration/mitoses)", druggable_targets: "BRAF V600, MEK, PD-1, CTLA-4, LAG-3, KIT (mucosal), PKC (uveal)" },

    { cancer_type: "Head & Neck", icd10: "C76.0", icd_o3_topography: "C00-14, C32", subtype_name: "Squamous cell carcinoma (HNSCC)", icd_o3_morphology: "8070/3", staging_system: "AJCC TNM 8th (HPV-specific p16)", druggable_targets: "EGFR, PD-1/PD-L1, TMB" },

    { cancer_type: "Esophageal", icd10: "C15.9", icd_o3_topography: "C15.9", subtype_name: "Adenocarcinoma / Squamous", icd_o3_morphology: "8140/3; 8070/3", staging_system: "AJCC TNM 8th", druggable_targets: "HER2, PD-1, VEGFR2, FGFR (SCC), CLDN18.2" },

    { cancer_type: "CNS", icd10: "C71.9", icd_o3_topography: "C71.9", subtype_name: "Glioma (Grade 2-4) / GBM", icd_o3_morphology: "9380/3; 9440/3", staging_system: "WHO CNS 5th Ed (Grade 1-4 integrated)", druggable_targets: "EGFR (EGFRvIII), IDH (ivosidenib - IDH1), VEGF, CDK4/6" },

    { cancer_type: "Leukemia", icd10: "C92.0", icd_o3_topography: "C42.1", subtype_name: "AML (acute myeloid)", icd_o3_morphology: "9861/3", staging_system: "WHO 2022 / ICC 2022 Classification", druggable_targets: "FLT3, IDH1, IDH2, BCL-2 (venetoclax), CD33 (GO), CD123" },
    { cancer_type: "Leukemia", icd10: "C91.0", icd_o3_topography: "C42.1", subtype_name: "ALL (B-cell / T-cell)", icd_o3_morphology: "9728/3; 9837/3", staging_system: "WHO 2022 / ICC 2022 Classification", druggable_targets: "ABL1 (imatinib/ponatinib, Ph+), NOTCH1, CD19 (BiTE/CAR-T), CD22" },
    { cancer_type: "Leukemia", icd10: "C91.1", icd_o3_topography: "C42.1", subtype_name: "CLL / SLL", icd_o3_morphology: "9823/3", staging_system: "Rai + Binet Staging", druggable_targets: "BTK (ibrutinib/acalabrutinib), BCL-2 (venetoclax), PI3K, CD20" },
    { cancer_type: "Leukemia", icd10: "C92.1", icd_o3_topography: "C42.1", subtype_name: "CML (chronic myeloid)", icd_o3_morphology: "9863/3", staging_system: "Phase-based (Chronic/Accelerated/Blast)", druggable_targets: "ABL1 kinase (imatinib/dasatinib/nilotinib/bosutinib/ponatinib/asciminib)" },

    { cancer_type: "Lymphoma", icd10: "C81.9", icd_o3_topography: "C42.0", subtype_name: "Hodgkin (cHL)", icd_o3_morphology: "9650/3", staging_system: "Ann Arbor + Lugano (Deauville PET)", druggable_targets: "CD30 (brentuximab), PD-1, JAK2" },
    { cancer_type: "Lymphoma", icd10: "C83.3", icd_o3_topography: "C42.0", subtype_name: "DLBCL (diffuse large B-cell)", icd_o3_morphology: "9680/3", staging_system: "Ann Arbor + Lugano (Deauville PET)", druggable_targets: "CD20 (rituximab), BCL-2 (venetoclax - HGBL), PD-1, CART-19/22, BTK (ABC)" },
    { cancer_type: "Lymphoma", icd10: "C82.9", icd_o3_topography: "C42.0", subtype_name: "Follicular lymphoma (FL)", icd_o3_morphology: "9690/3", staging_system: "Ann Arbor + Lugano + FLIPI/FLIPI-2", druggable_targets: "CD20, BCL-2 (venetoclax), EZH2 (tazemetostat), PI3K, PD-1" },

    { cancer_type: "Myeloma", icd10: "C90.0", icd_o3_topography: "C42.1", subtype_name: "Plasma cell myeloma (MM)", icd_o3_morphology: "9732/3", staging_system: "R-ISS / R2-ISS Staging", druggable_targets: "CD38 (dara/isa), BCMA (bela/ide-cel/cilta-cel), GPRC5D, FcRH5, SLAMF7" },
];

// ---------------------------------------------------------------------------
// Sheet 2 - Breast Subtypes, reduced to the 5 canonical PAM50-surrogate
// outputs Algorithm E2 actually produces (see plan doc, conflict-resolution
// note #2 - the source sheet's 11-row clinical-prose table has no
// er_rule/pr_rule/her2_rule/colour columns, so this uses the badge colours
// given in the design guide's Algorithm E2 prose instead).
// ---------------------------------------------------------------------------
const MOLECULAR_SUBTYPES = [
    { subtype_name: "Luminal A", er_rule: "Positive", pr_rule: "Any", her2_rule: "Negative", ki67_threshold: 14, colour_hex: "#4CAF50", badge_label: "Luminal A" },
    { subtype_name: "Luminal B HER2-", er_rule: "Positive", pr_rule: "Any", her2_rule: "Negative", ki67_threshold: 14, colour_hex: "#FFC107", badge_label: "Luminal B HER2-" },
    { subtype_name: "Luminal B HER2+", er_rule: "Positive", pr_rule: "Any", her2_rule: "Positive", ki67_threshold: 14, colour_hex: "#FF9800", badge_label: "Luminal B HER2+" },
    { subtype_name: "HER2-Enriched", er_rule: "Negative", pr_rule: "Negative", her2_rule: "Positive", ki67_threshold: 14, colour_hex: "#9C27B0", badge_label: "HER2-Enriched" },
    { subtype_name: "TNBC", er_rule: "Negative", pr_rule: "Negative", her2_rule: "Negative", ki67_threshold: 14, colour_hex: "#F44336", badge_label: "TNBC" },
];

// ---------------------------------------------------------------------------
// Sheet 3 - Biomarkers Lookup (26 rows)
// ---------------------------------------------------------------------------
const BIOMARKER_TESTS = [
    { biomarker_name: "ER (Estrogen Receptor)", test_method: "IHC (SP1/1D5 Ab)", threshold_value: ">=1% nuclear staining = positive", drug_target: "Tamoxifen, Aromatase inhibitors, Fulvestrant, CDK4/6i", nccn_level: "Tier IA", applicable_cancers: "Breast, Endometrial, Ovarian", guideline_source: "ASCO/CAP 2020" },
    { biomarker_name: "PR (Progesterone Receptor)", test_method: "IHC (PgR 636/1E2 Ab)", threshold_value: ">=1% nuclear staining = positive", drug_target: "ET regimens (secondary predictive marker)", nccn_level: "Tier IA", applicable_cancers: "Breast, Endometrial", guideline_source: "ASCO/CAP 2020" },
    { biomarker_name: "HER2 (ERBB2) - IHC", test_method: "IHC (4B5/SP3 Ab) + FISH/ISH reflex", threshold_value: "3+ positive; 2+ equivocal -> FISH; 1+ low; 0+faint = ultralow", drug_target: "Trastuzumab, Pertuzumab, T-DM1, T-DXd, Lapatinib, Tucatinib, Neratinib", nccn_level: "Tier IA", applicable_cancers: "Breast, Gastric, Esophageal, CRC, Lung (adeno)", guideline_source: "ASCO/CAP 2023 (Breast); ESMO 2022 (Gastric)" },
    { biomarker_name: "HER2 (ERBB2) - FISH/ISH", test_method: "FISH/ISH (dual-probe)", threshold_value: "Amplified: ratio >=2.0 and/or avg copy >=6.0/cell", drug_target: "Same as IHC 3+ - anti-HER2 therapy", nccn_level: "Tier IA", applicable_cancers: "Breast, Gastric", guideline_source: "ASCO/CAP 2023" },
    { biomarker_name: "Ki-67 (proliferation index)", test_method: "IHC (MIB-1 Ab)", threshold_value: "BC: <14% low; >=14-20% intermediate; >=20-30% high", drug_target: "Prognostic; CDK4/6 resistance prediction", nccn_level: "Tier IIB", applicable_cancers: "Breast (all subtypes), Neuroendocrine", guideline_source: "St. Gallen 2023; ENETS 2022" },
    { biomarker_name: "PD-L1 (CD274)", test_method: "IHC (22C3/28-8/SP142/SP263)", threshold_value: "TPS >=1%/CPS >=1%/CPS >=10%/IC >=1% - clone/assay specific", drug_target: "Pembrolizumab, Atezolizumab, Nivolumab, Durvalumab, Cemiplimab", nccn_level: "Tier IA (clone-specific)", applicable_cancers: "Lung, HNSCC, Gastric, Cervical, Bladder, TNBC, DLBCL, ESCC, HCC", guideline_source: "NCCN per tumour type" },
    { biomarker_name: "MMR (MLH1/MSH2/MSH6/PMS2)", test_method: "IHC (4-antibody panel)", threshold_value: "Loss of any protein = dMMR -> reflex MSI PCR/NGS", drug_target: "Pembrolizumab, Dostarlimab; Ipilimumab+nivo (CRC)", nccn_level: "Tier IA", applicable_cancers: "CRC, Endometrial, Gastric, Pancreatic, any tumour", guideline_source: "NCCN 2024; ESMO 2023" },
    { biomarker_name: "p53 (TP53 protein)", test_method: "IHC (DO-7 Ab)", threshold_value: "Abnormal: overexpression >80% strong OR null 0%", drug_target: "Prognostic (not directly targeted)", nccn_level: "Tier IIB", applicable_cancers: "Breast (serous-like), Ovarian (HGSOC), Endometrial, Bladder", guideline_source: "WHO 5th Ed; ProMisE; ESMO" },
    { biomarker_name: "EGFR mutations", test_method: "PCR/NGS (tissue or ctDNA)", threshold_value: "Sensitising: ex19del, L858R, G719X, S768I, L861Q; Resistant: T790M; ex20ins", drug_target: "Gefitinib, Erlotinib, Afatinib, Osimertinib, Amivantamab, Mobocertinib", nccn_level: "Tier IA", applicable_cancers: "NSCLC (adenocarcinoma)", guideline_source: "NCCN NSCLC 2024; ESMO NSCLC 2023" },
    { biomarker_name: "ALK fusions", test_method: "IHC (D5F3) + FISH + NGS", threshold_value: "Any ALK fusion = positive; IHC 3+ sufficient in NSCLC", drug_target: "Crizotinib, Alectinib, Brigatinib, Lorlatinib, Ceritinib", nccn_level: "Tier IA", applicable_cancers: "NSCLC, ALCL, IMT, neuroblastoma", guideline_source: "NCCN NSCLC 2024; ESMO 2023" },
    { biomarker_name: "ROS1 fusions", test_method: "IHC (D4D6) + FISH + RNA-seq", threshold_value: "Any ROS1 fusion = positive; confirm IHC-positive with FISH/NGS", drug_target: "Crizotinib, Entrectinib, Lorlatinib, Repotrectinib", nccn_level: "Tier IA", applicable_cancers: "NSCLC (~1-2%), cholangiocarcinoma", guideline_source: "NCCN 2024; ESMO 2023" },
    { biomarker_name: "KRAS G12C", test_method: "NGS tissue or ctDNA", threshold_value: "KRAS p.G12C = sotorasib/adagrasib eligible", drug_target: "Sotorasib, Adagrasib, Divarasib", nccn_level: "Tier IA (NSCLC); Tier IB (CRC)", applicable_cancers: "NSCLC (~13%), CRC (~3%), PDAC (~1%)", guideline_source: "NCCN NSCLC 2024; ESMO CRC 2023" },
    { biomarker_name: "BRAF V600E", test_method: "Allele-specific PCR (cobas) or NGS", threshold_value: "p.V600E = dabrafenib+trametinib eligible", drug_target: "Dabrafenib, Trametinib, Vemurafenib, Cobimetinib, Encorafenib+cetuximab", nccn_level: "Tier IA", applicable_cancers: "Melanoma, NSCLC, CRC, Thyroid, Hairy-cell leukemia, Glioma", guideline_source: "NCCN per tumour; ESMO melanoma 2023" },
    { biomarker_name: "BRCA1/2 (germline + somatic)", test_method: "Germline: blood/saliva NGS; Somatic: tumour NGS", threshold_value: "Any pathogenic/likely pathogenic variant = PARP inhibitor eligible", drug_target: "Olaparib, Niraparib, Rucaparib, Talazoparib, Veliparib", nccn_level: "Tier IA", applicable_cancers: "Breast, Ovarian, Prostate, Pancreatic, all tumours (BRCAm)", guideline_source: "NCCN Breast/Ovarian/Prostate 2024; ACMG" },
    { biomarker_name: "HRD (Homologous Recombination Deficiency)", test_method: "Genomic scar assay (myChoice CDx / FMI) or HRR gene NGS panel", threshold_value: "myChoice HRD >=42 = positive; SOD >=33 (PRIMA)", drug_target: "Olaparib+bevacizumab, Niraparib, Rucaparib, Veliparib", nccn_level: "Tier IA (BRCA); Tier IB (HRD+)", applicable_cancers: "Ovarian, Breast, Prostate, Pancreatic", guideline_source: "ESMO Ovarian 2023; NCCN Ovarian 2024" },
    { biomarker_name: "MSI-H / TMB-H", test_method: "MSI: PCR (5-marker) or IHC reflex; TMB: NGS mut/Mb", threshold_value: "MSI-H = pembrolizumab; TMB-H >=10 mut/Mb = pembrolizumab", drug_target: "Pembrolizumab, Dostarlimab, Ipilimumab+nivolumab (CRC MSI-H)", nccn_level: "Tier IA (MSI-H); Tier IB (TMB-H)", applicable_cancers: "All solid tumours (pan-tumour approved)", guideline_source: "FDA 2017/2020; NCCN 2024" },
    { biomarker_name: "FGFR alterations (mut/fus/amp)", test_method: "NGS - SNV, fusions (RNA-based preferred), CNV", threshold_value: "FGFR3 S249C/R248C+mut = erdafitinib; FGFR2 fusions = pemigatinib/futibatinib/infigratinib", drug_target: "Erdafitinib, Pemigatinib, Futibatinib, Infigratinib", nccn_level: "Tier IA", applicable_cancers: "Bladder (FGFR3), Cholangiocarcinoma (FGFR2), Breast (FGFR1 amp), NSCLC (FGFR1)", guideline_source: "NCCN Bladder/CCA 2024; ESMO 2023" },
    { biomarker_name: "NTRK1/2/3 fusions", test_method: "IHC (pan-TRK D5F3 screening) + NGS/RNA-seq confirmation", threshold_value: "Any pathogenic NTRK1/2/3 fusion = larotrectinib/entrectinib", drug_target: "Larotrectinib, Entrectinib, Repotrectinib", nccn_level: "Tier IA", applicable_cancers: "All solid tumours (pan-tumour, any age)", guideline_source: "FDA 2018/2019; NCCN 2024" },
    { biomarker_name: "RET fusions + mutations", test_method: "NGS tissue + liquid; RNA-seq for fusions; PCR for known MTC mutations", threshold_value: "NSCLC RET fus = selpercatinib/pralsetinib; MTC RET mut (any) actionable", drug_target: "Selpercatinib, Pralsetinib, Vandetanib, Cabozantinib", nccn_level: "Tier IA", applicable_cancers: "NSCLC (RET fus ~1-2%), Thyroid (PTC/MTC)", guideline_source: "NCCN NSCLC/Thyroid 2024; ESMO 2023" },
    { biomarker_name: "FLT3 mutations (ITD/TKD)", test_method: "PCR (ITD allelic ratio) + NGS (TKD D835)", threshold_value: "FLT3-ITD any VAF actionable; ITD AR >=0.5 = ELN Adverse risk", drug_target: "Midostaurin, Quizartinib, Gilteritinib, Crenolanib (trial)", nccn_level: "Tier IA", applicable_cancers: "AML", guideline_source: "ELN 2022; NCCN AML 2024" },
    { biomarker_name: "NPM1 mutations", test_method: "PCR (Type A/B/D) + NGS", threshold_value: "NPM1 mut without FLT3-ITD = ELN Favourable", drug_target: "Venetoclax+HMA, Ivosidenib +/- azacitidine (IDH1 co-mut)", nccn_level: "Tier IA", applicable_cancers: "AML", guideline_source: "ELN 2022; NCCN AML 2024" },
    { biomarker_name: "IDH1 (R132) / IDH2 (R140/R172)", test_method: "NGS; IDH1 R132H IHC (H09 Ab) in glioma; allele-specific PCR", threshold_value: "Any IDH1/2 mut in AML actionable; Glioma IDH1/2 mut = grade 2-3 (WHO 5th)", drug_target: "Ivosidenib, Enasidenib, Olutasidenib, Vorasidenib", nccn_level: "Tier IA", applicable_cancers: "AML, MDS, Cholangiocarcinoma, Glioma", guideline_source: "NCCN AML/Glioma/CCA 2024; ELN 2022; WHO CNS 2021" },
    { biomarker_name: "BCR-ABL1 (t9;22)", test_method: "RT-PCR (IS %) + FISH; KD mutation sequencing on progression", threshold_value: "Optimal MR3 <=0.1% at 12mo; deep MR4/4.5 = TFR eligibility; T315I = ponatinib/asciminib only", drug_target: "Imatinib, Dasatinib, Nilotinib, Bosutinib, Ponatinib, Asciminib", nccn_level: "Tier IA", applicable_cancers: "CML, Ph+ ALL, occasionally AML", guideline_source: "ELN CML 2020; NCCN 2024" },
    { biomarker_name: "PIK3CA mutations", test_method: "NGS tissue or liquid biopsy ctDNA", threshold_value: "Any PIK3CA mut in ER+ HER2- metastatic BC = alpelisib+fulvestrant eligible", drug_target: "Alpelisib, Capivasertib+fulvestrant, Everolimus", nccn_level: "Tier IA (BC); Tier IIB (others)", applicable_cancers: "Breast (HR+), CRC, HNSCC, Ovarian, Endometrial", guideline_source: "NCCN Breast 2024; FDA 2019/2023" },
    { biomarker_name: "AR (Androgen Receptor)", test_method: "IHC (AR 441 Ab); AR-V7 by IHC/RNA; AR copy number by NGS", threshold_value: "Prostate AR-V7+ = TKI resistance; TNBC LAR: AR+ >=10% = enzalutamide trial eligible", drug_target: "Enzalutamide, Apalutamide, Darolutamide, Abiraterone", nccn_level: "Tier IA (prostate)", applicable_cancers: "Prostate, TNBC (LAR subtype), CRPC", guideline_source: "NCCN Prostate 2024; ESMO 2023" },
    { biomarker_name: "CLDN18.2 (Claudin 18.2)", test_method: "IHC (CLAUDIN18 43-14A Ab)", threshold_value: ">=75% cells with >=2+ IHC = zolbetuximab eligible", drug_target: "Zolbetuximab (IMAB362)", nccn_level: "Tier IA (gastric/GEJ)", applicable_cancers: "Gastric/GEJ, Esophageal, PDAC (emerging)", guideline_source: "FDA 2024; ESMO Upper GI 2023; NCCN 2024" },
];

// ---------------------------------------------------------------------------
// Sheet 7 - Staging & Risk (~104 rows). cancer_type below is matched to the
// cancer_types row created from CANCER_REFERENCE above (case-insensitive).
// ---------------------------------------------------------------------------
const STAGING_REFERENCE = [
    // BREAST
    { cancer_type: "Breast", subtype_label: "IDC / ILC (all subtypes)", staging_system: "AJCC 8th Ed", stage_label: "Stage I", tnm_criteria: "T1 N0 M0 (T1a/b/c based on tumour size <1/<0.5/<1 cm)", risk_system: "St Gallen 2021", risk_category: "Low Risk", risk_criteria: "ER+ HER2- Luminal A; grade 1-2; Ki-67 <14%; pN0", os_5yr_approx: "~99%", guideline_source: "AJCC 8th; NCCN Breast v4.2024" },
    { cancer_type: "Breast", subtype_label: "IDC / ILC (all subtypes)", staging_system: "AJCC 8th Ed", stage_label: "Stage IIA", tnm_criteria: "T0-1 N1 M0 OR T2 N0 M0", risk_system: "St Gallen 2021", risk_category: "Intermediate Risk", risk_criteria: "Luminal A with 1-3 LN+; or Luminal B grade 3; Ki-67 >=14%", os_5yr_approx: "~87%", guideline_source: "AJCC 8th; NCCN Breast v4.2024" },
    { cancer_type: "Breast", subtype_label: "IDC / ILC (all subtypes)", staging_system: "AJCC 8th Ed", stage_label: "Stage IIB", tnm_criteria: "T2 N1 M0 OR T3 N0 M0", risk_system: "St Gallen 2021", risk_category: "High Risk", risk_criteria: "HER2+; TNBC; grade 3; 4+ nodes; or Luminal B HER2+", os_5yr_approx: "~75%", guideline_source: "AJCC 8th; NCCN Breast v4.2024" },
    { cancer_type: "Breast", subtype_label: "IDC / ILC (all subtypes)", staging_system: "AJCC 8th Ed", stage_label: "Stage IIIA-C", tnm_criteria: "T3 N1 M0; T0-3 N2 M0; any T N3 M0", risk_system: "St Gallen 2021", risk_category: "Very High Risk", risk_criteria: ">=4 LN+; inflammatory; internal mammary nodes; TNBC; HER2+", os_5yr_approx: "~55%", guideline_source: "AJCC 8th; NCCN Breast v4.2024" },
    { cancer_type: "Breast", subtype_label: "IDC / ILC (all subtypes)", staging_system: "AJCC 8th Ed", stage_label: "Stage IV", tnm_criteria: "Any T, Any N, M1 (distant metastasis)", risk_system: null, risk_category: "Metastatic", risk_criteria: "HR+/HER2-: CDK4/6i + AI; HER2+: dual anti-HER2 + chemo; TNBC: pembro + chemo; BRCA1/2: olaparib", os_5yr_approx: "~28%", guideline_source: "AJCC 8th; NCCN Breast v4.2024" },
    // LUNG
    { cancer_type: "Lung", subtype_label: "NSCLC (Adeno / Squamous)", staging_system: "AJCC 8th Ed", stage_label: "Stage IA", tnm_criteria: "T1a-c N0 M0 (<=3 cm, surrounded by lung)", risk_system: null, risk_category: null, risk_criteria: "Resectable; lobectomy is standard", os_5yr_approx: "~92%", guideline_source: "AJCC 8th; NCCN NSCLC v2.2024" },
    { cancer_type: "Lung", subtype_label: "NSCLC (Adeno / Squamous)", staging_system: "AJCC 8th Ed", stage_label: "Stage IB-IIA", tnm_criteria: "T2a-b N0 M0 / T1 N1 M0", risk_system: null, risk_category: null, risk_criteria: "Resection; adjuvant osimertinib if EGFR+ (ADAURA)", os_5yr_approx: "~60%", guideline_source: "AJCC 8th; NCCN NSCLC v2.2024" },
    { cancer_type: "Lung", subtype_label: "NSCLC (Adeno / Squamous)", staging_system: "AJCC 8th Ed", stage_label: "Stage IIIA-C", tnm_criteria: "Any T N2 M0 / T3-4 N2-3 M0 / invades mediastinum", risk_system: null, risk_category: "Unresectable (IIIC)", risk_criteria: "Concurrent CRT + durvalumab consolidation (PACIFIC)", os_5yr_approx: "~22%", guideline_source: "AJCC 8th; NCCN NSCLC v2.2024" },
    { cancer_type: "Lung", subtype_label: "NSCLC (Adeno / Squamous)", staging_system: "AJCC 8th Ed", stage_label: "Stage IV", tnm_criteria: "Any T, Any N, M1a/b/c (pleural, pericardial, distant mets)", risk_system: "EGFR/ALK/ROS1/KRAS/PD-L1", risk_category: "Driver-defined", risk_criteria: "EGFR Exon19/L858R -> Osimertinib; ALK -> Alectinib; KRAS G12C -> Sotorasib; PD-L1 >=50% -> Pembro monotherapy", os_5yr_approx: "~10%", guideline_source: "AJCC 8th; NCCN NSCLC v2.2024" },
    { cancer_type: "Lung", subtype_label: "SCLC", staging_system: "VALSG", stage_label: "Limited Stage", tnm_criteria: "Disease confined to one hemithorax + ipsilateral supraclavicular nodes", risk_system: null, risk_category: "LS-SCLC", risk_criteria: "Concurrent platinum-etoposide + thoracic RT + PCI", os_5yr_approx: "~25% (2yr)", guideline_source: "VALSG; NCCN SCLC v1.2024" },
    { cancer_type: "Lung", subtype_label: "SCLC", staging_system: "VALSG", stage_label: "Extensive Stage", tnm_criteria: "Disease beyond one RT port / pleural effusion / contralateral nodes", risk_system: null, risk_category: "ES-SCLC", risk_criteria: "Atezolizumab or durvalumab + platinum-etoposide (IMpower133/CASPIAN)", os_5yr_approx: "~5% (2yr)", guideline_source: "VALSG; NCCN SCLC v1.2024" },
    // COLORECTAL
    { cancer_type: "Colorectal", subtype_label: "Colorectal Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage I", tnm_criteria: "T1-2 N0 M0 (submucosa / muscularis propria; no LN)", risk_system: null, risk_category: "Low Risk", risk_criteria: "Surgery alone; no adjuvant therapy required", os_5yr_approx: "~90%", guideline_source: "AJCC 8th; NCCN CRC v3.2024" },
    { cancer_type: "Colorectal", subtype_label: "Colorectal Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage II", tnm_criteria: "T3-4 N0 M0", risk_system: "MMR / MSI", risk_category: "Stage II High Risk", risk_criteria: "High risk features: T4, perforation, <12 LN examined, LVI/PNI; pMMR: consider FOLFOX; dMMR: watch", os_5yr_approx: "~75%", guideline_source: "AJCC 8th; NCCN CRC v3.2024" },
    { cancer_type: "Colorectal", subtype_label: "Colorectal Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage III", tnm_criteria: "Any T N1-2 M0 (1-3 or >=4 regional LN+)", risk_system: "RAS/BRAF", risk_category: "N1 / N2", risk_criteria: "FOLFOX or CAPOX x6 months adjuvant; dMMR -> pembro (KEYNOTE-177)", os_5yr_approx: "~50%", guideline_source: "AJCC 8th; NCCN CRC v3.2024" },
    { cancer_type: "Colorectal", subtype_label: "Colorectal Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage IV", tnm_criteria: "Any T, Any N, M1a/b/c", risk_system: "RAS/BRAF/MSI/HER2", risk_category: "Metastatic", risk_criteria: "RAS wt + left-sided: anti-EGFR + doublet; BRAF V600E: encorafenib+cetuximab+binimetinib; dMMR: pembro 1st line", os_5yr_approx: "~15%", guideline_source: "AJCC 8th; NCCN CRC v3.2024" },
    // PROSTATE
    { cancer_type: "Prostate", subtype_label: "Prostate Adenocarcinoma", staging_system: "AJCC 8th + NCCN", stage_label: "Very Low Risk", tnm_criteria: "T1c, Grade Group 1, PSA <10, <3 cores+, <=50% cancer/core, PSAD <0.15", risk_system: "NCCN Risk Groups", risk_category: "Very Low Risk", risk_criteria: "Active surveillance preferred", os_5yr_approx: ">99% (10yr)", guideline_source: "NCCN Prostate v4.2024" },
    { cancer_type: "Prostate", subtype_label: "Prostate Adenocarcinoma", staging_system: "AJCC 8th + NCCN", stage_label: "Low Risk", tnm_criteria: "T1-2a, Grade Group 1, PSA <10 (not qualifying for Very Low)", risk_system: "NCCN Risk Groups", risk_category: "Low Risk", risk_criteria: "Active surveillance; or RP / EBRT if preferred", os_5yr_approx: ">95% (10yr)", guideline_source: "NCCN Prostate v4.2024" },
    { cancer_type: "Prostate", subtype_label: "Prostate Adenocarcinoma", staging_system: "AJCC 8th + NCCN", stage_label: "Favourable Intermediate Risk", tnm_criteria: "1 IR factor; Grade Group 1 or 2; <50% cores positive; PSA 10-20", risk_system: "NCCN Risk Groups", risk_category: "Favourable IR", risk_criteria: "Active surveillance (GG1) or definitive RP/EBRT +/- 4-6m ADT", os_5yr_approx: "~90% (10yr)", guideline_source: "NCCN Prostate v4.2024" },
    { cancer_type: "Prostate", subtype_label: "Prostate Adenocarcinoma", staging_system: "AJCC 8th + NCCN", stage_label: "Unfavourable Intermediate Risk", tnm_criteria: ">=2 IR factors; or Grade Group 3; or >=50% cores positive", risk_system: "NCCN Risk Groups", risk_category: "Unfavourable IR", risk_criteria: "RP or EBRT + 4-6m ADT", os_5yr_approx: "~80% (10yr)", guideline_source: "NCCN Prostate v4.2024" },
    { cancer_type: "Prostate", subtype_label: "Prostate Adenocarcinoma", staging_system: "AJCC 8th + NCCN", stage_label: "High / Very High Risk", tnm_criteria: "T3a-4 or Grade Group 4-5 or PSA >20 (High); T3b-4 or primary GG5 or >=2 HR factors (Very High)", risk_system: "NCCN Risk Groups", risk_category: "High / Very High", risk_criteria: "EBRT + 1.5-3yr ADT or RP in selected; abiraterone added (STAMPEDE)", os_5yr_approx: "~50-65% (10yr)", guideline_source: "NCCN Prostate v4.2024" },
    { cancer_type: "Prostate", subtype_label: "Prostate Adenocarcinoma", staging_system: "AJCC 8th + NCCN", stage_label: "Stage IV (M1)", tnm_criteria: "Any T, N1 M0 = regional; M1a/b/c = distant (nodes/bone/visceral)", risk_system: "mHSPC / mCRPC", risk_category: "mHSPC / mCRPC", risk_criteria: "mHSPC: ADT + darolutamide/enzalutamide/abiraterone + docetaxel; mCRPC: per prior therapy", os_5yr_approx: "~30% (5yr mHSPC)", guideline_source: "NCCN Prostate v4.2024" },
    // GASTRIC / GEJ
    { cancer_type: "Gastric / GEJ", subtype_label: "Gastric / GEJ Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage I", tnm_criteria: "T1-2 N0 M0", risk_system: "HER2 / PD-L1", risk_category: "Resectable", risk_criteria: "D2 gastrectomy; perioperative FLOT if T3-4/N+", os_5yr_approx: "~70%", guideline_source: "AJCC 8th; NCCN Gastric v2.2024" },
    { cancer_type: "Gastric / GEJ", subtype_label: "Gastric / GEJ Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage II-III", tnm_criteria: "T2-4 N0-3 M0", risk_system: "HER2 / PD-L1 CPS", risk_category: "Resectable (II) / Borderline (III)", risk_criteria: "Perioperative FLOT (FLOT4) or adjuvant FOLFOX; if HER2+: trastuzumab", os_5yr_approx: "~35-55%", guideline_source: "AJCC 8th; NCCN Gastric v2.2024" },
    { cancer_type: "Gastric / GEJ", subtype_label: "Gastric / GEJ Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage IV", tnm_criteria: "Any T, Any N, M1", risk_system: "HER2 / PD-L1 / dMMR", risk_category: "Metastatic", risk_criteria: "1L: HER2+: pembrolizumab+trastuzumab+FP; HER2-: nivolumab+FOLFOX/XELOX; dMMR: pembro", os_5yr_approx: "~8%", guideline_source: "AJCC 8th; NCCN Gastric v2.2024" },
    // PANCREATIC
    { cancer_type: "Pancreatic", subtype_label: "Pancreatic Ductal Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage IA-IB", tnm_criteria: "T1-2 N0 M0 (T1: <=2cm, T2: >2-4cm; no LN)", risk_system: "BRCA1/2 / KRAS", risk_category: "Resectable", risk_criteria: "Upfront resection -> adjuvant mFOLFIRINOX x12 cycles; BRCA: maintenance olaparib", os_5yr_approx: "~20-25%", guideline_source: "AJCC 8th; NCCN Pancreatic v2.2024" },
    { cancer_type: "Pancreatic", subtype_label: "Pancreatic Ductal Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage II-III", tnm_criteria: "T3-4 N0-2 M0 (T3: >4cm; T4: involves coeliac/SMA)", risk_system: null, risk_category: "Borderline / Locally Advanced", risk_criteria: "Neoadjuvant FOLFIRINOX -> restage; if unresectable: CRT or continued chemo", os_5yr_approx: "~8-12%", guideline_source: "AJCC 8th; NCCN Pancreatic v2.2024" },
    { cancer_type: "Pancreatic", subtype_label: "Pancreatic Ductal Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage IV", tnm_criteria: "Any T, Any N, M1", risk_system: "BRCA1/2 / KRAS / MSI", risk_category: "Metastatic", risk_criteria: "FOLFIRINOX or GemNab; BRCA1/2+: platinum -> maintenance olaparib (POLO); KRAS wt: erlotinib (modest)", os_5yr_approx: "~3%", guideline_source: "AJCC 8th; NCCN Pancreatic v2.2024" },
    // LIVER
    { cancer_type: "Liver", subtype_label: "Hepatocellular Carcinoma", staging_system: "BCLC 2022", stage_label: "BCLC 0 (Very Early)", tnm_criteria: "Single <=2cm; PS 0; Child-Pugh A", risk_system: "AFP", risk_category: "Very Early", risk_criteria: "Resection or ablation; 5yr OS >70%", os_5yr_approx: ">70%", guideline_source: "BCLC 2022; NCCN HCC v1.2024" },
    { cancer_type: "Liver", subtype_label: "Hepatocellular Carcinoma", staging_system: "BCLC 2022", stage_label: "BCLC A (Early)", tnm_criteria: "Single or up to 3 nodules <=3cm; PS 0; Child-Pugh A-B", risk_system: "AFP", risk_category: "Early", risk_criteria: "Resection (solitary, adequate reserve) or liver transplant (Milan) or ablation", os_5yr_approx: "~50-70%", guideline_source: "BCLC 2022; NCCN HCC v1.2024" },
    { cancer_type: "Liver", subtype_label: "Hepatocellular Carcinoma", staging_system: "BCLC 2022", stage_label: "BCLC B (Intermediate)", tnm_criteria: "Multinodular, no vascular invasion, no EHD; PS 0; Child-Pugh A-B", risk_system: "AFP", risk_category: "Intermediate", risk_criteria: "TACE (conventional or DEB-TACE); TACE+sorafenib being studied", os_5yr_approx: "~20-40%", guideline_source: "BCLC 2022; NCCN HCC v1.2024" },
    { cancer_type: "Liver", subtype_label: "Hepatocellular Carcinoma", staging_system: "BCLC 2022", stage_label: "BCLC C (Advanced)", tnm_criteria: "Vascular invasion OR extra-hepatic spread; PS 1-2; Child-Pugh A-B", risk_system: "AFP", risk_category: "Advanced", risk_criteria: "Atezolizumab + bevacizumab (IMbrave150) 1L; sorafenib/lenvatinib alternatives", os_5yr_approx: "~12-15%", guideline_source: "BCLC 2022; NCCN HCC v1.2024" },
    { cancer_type: "Liver", subtype_label: "Hepatocellular Carcinoma", staging_system: "BCLC 2022", stage_label: "BCLC D (Terminal)", tnm_criteria: "PS 3-4 OR Child-Pugh C", risk_system: null, risk_category: "Terminal / Palliative", risk_criteria: "Best supportive care; systemic therapy generally not tolerated", os_5yr_approx: "<3%", guideline_source: "BCLC 2022; NCCN HCC v1.2024" },
    // OVARIAN
    { cancer_type: "Ovarian", subtype_label: "HGSOC / Clear Cell / Endometrioid", staging_system: "FIGO 2014", stage_label: "FIGO I", tnm_criteria: "IA: one ovary, capsule intact; IB: both ovaries; IC: capsule ruptured/positive cytology", risk_system: "BRCA1/2 / HRD", risk_category: "Early", risk_criteria: "IA/B Grade 1-2: surgery alone; IC or Grade 3: carboplatin+paclitaxel x3-6 cycles", os_5yr_approx: "~80-90%", guideline_source: "FIGO 2014; NCCN Ovarian v1.2024" },
    { cancer_type: "Ovarian", subtype_label: "HGSOC / Clear Cell / Endometrioid", staging_system: "FIGO 2014", stage_label: "FIGO II", tnm_criteria: "Extension to pelvis (IIA: uterus/tubes; IIB: other pelvic organs)", risk_system: "BRCA1/2 / HRD", risk_category: "Early-Advanced", risk_criteria: "Surgical debulking + carboplatin-paclitaxel x6 cycles; consider bevacizumab (ICON7)", os_5yr_approx: "~65-75%", guideline_source: "FIGO 2014; NCCN Ovarian v1.2024" },
    { cancer_type: "Ovarian", subtype_label: "HGSOC / Clear Cell / Endometrioid", staging_system: "FIGO 2014", stage_label: "FIGO III", tnm_criteria: "Peritoneal mets / RP LN (IIIA1: RP only; IIIA2: microscopic; IIIB <=2cm; IIIC >2cm)", risk_system: "BRCA1/2 / HRD", risk_category: "Advanced", risk_criteria: "Upfront debulking + carboplatin-paclitaxel+bevacizumab -> maintenance: BRCA+: olaparib (SOLO-1); HRD+: niraparib/olaparib", os_5yr_approx: "~29-45%", guideline_source: "FIGO 2014; NCCN Ovarian v1.2024" },
    { cancer_type: "Ovarian", subtype_label: "HGSOC / Clear Cell / Endometrioid", staging_system: "FIGO 2014", stage_label: "FIGO IV", tnm_criteria: "Distant mets (IVA: pleural effusion+; IVB: parenchymal liver/spleen/extra-abdominal LN)", risk_system: "BRCA1/2 / HRD", risk_category: "Metastatic", risk_criteria: "NACT (carboplatin-paclitaxel x3) -> interval debulking -> 3 more cycles + maintenance PARP inhibitor", os_5yr_approx: "~17%", guideline_source: "FIGO 2014; NCCN Ovarian v1.2024" },
    // ENDOMETRIAL
    { cancer_type: "Endometrial", subtype_label: "Endometrial Carcinoma (all histologies)", staging_system: "FIGO 2023", stage_label: "FIGO I", tnm_criteria: "IA: <50% myometrial invasion, no LVSI; IB: >=50% invasion, no LVSI; IC: >=50%+substantial LVSI", risk_system: "MMR / p53 / POLE", risk_category: "Low / Intermediate", risk_criteria: "IA Grade 1-2 LVSI-: observation; IB/IC/Grade 3: vaginal VBT +/- EBRT", os_5yr_approx: "~85-95%", guideline_source: "FIGO 2023; NCCN Uterine v2.2024" },
    { cancer_type: "Endometrial", subtype_label: "Endometrial Carcinoma (all histologies)", staging_system: "FIGO 2023", stage_label: "FIGO II", tnm_criteria: "Cervical stromal invasion (IIA: LVSI absent/focal; IIB: substantial LVSI; IIC: cervical invasion p53abn)", risk_system: "MMR / p53 / POLE", risk_category: "Intermediate-High", risk_criteria: "TAH-BSO+EBRT+VBT; consider carboplatin-paclitaxel if p53abn or serous", os_5yr_approx: "~70-80%", guideline_source: "FIGO 2023; NCCN Uterine v2.2024" },
    { cancer_type: "Endometrial", subtype_label: "Endometrial Carcinoma (all histologies)", staging_system: "FIGO 2023", stage_label: "FIGO III-IVA", tnm_criteria: "Adnexal / pelvic/paraaortic LN / vaginal / pelvic organ invasion", risk_system: "dMMR / HER2", risk_category: "High", risk_criteria: "Surgery+EBRT+chemo (carboplatin-paclitaxel); pembrolizumab if dMMR; trastuzumab if HER2+ serous", os_5yr_approx: "~35-60%", guideline_source: "FIGO 2023; NCCN Uterine v2.2024" },
    { cancer_type: "Endometrial", subtype_label: "Endometrial Carcinoma (all histologies)", staging_system: "FIGO 2023", stage_label: "FIGO IVB", tnm_criteria: "Inguinal LN / intraperitoneal mets / distant mets", risk_system: "dMMR / HER2", risk_category: "Advanced / Metastatic", risk_criteria: "Carboplatin-paclitaxel+pembrolizumab (RUBY, dMMR); lenvatinib+pembro (pMMR, KEYNOTE-775)", os_5yr_approx: "~17%", guideline_source: "FIGO 2023; NCCN Uterine v2.2024" },
    // CERVICAL
    { cancer_type: "Cervical", subtype_label: "Cervical Carcinoma (SCC/Adeno)", staging_system: "FIGO 2018", stage_label: "FIGO I", tnm_criteria: "IA1: <3mm depth,<7mm width; IA2: 3-5mm; IB1: <=2cm; IB2: 2-4cm; IB3: >4cm", risk_system: "PD-L1 / dMMR", risk_category: "Early", risk_criteria: "IA1: LEEP/cone or TAH; IA2-IB1: RH+PLND or EBRT; IB2-IB3: CRT (cisplatin)", os_5yr_approx: "~85-93%", guideline_source: "FIGO 2018; NCCN Cervical v1.2024" },
    { cancer_type: "Cervical", subtype_label: "Cervical Carcinoma (SCC/Adeno)", staging_system: "FIGO 2018", stage_label: "FIGO II", tnm_criteria: "IIA: upper vagina, no parametrial; IIB: parametrial invasion", risk_system: "PD-L1", risk_category: "Locally Advanced", risk_criteria: "Concurrent CRT (cisplatin 40mg/m2 weekly) + brachytherapy", os_5yr_approx: "~65-75%", guideline_source: "FIGO 2018; NCCN Cervical v1.2024" },
    { cancer_type: "Cervical", subtype_label: "Cervical Carcinoma (SCC/Adeno)", staging_system: "FIGO 2018", stage_label: "FIGO III", tnm_criteria: "IIIA: lower 1/3 vagina; IIIB: hydronephrosis; IIIC: pelvic/para-aortic LN", risk_system: "PD-L1", risk_category: "Locally Advanced / Regional", risk_criteria: "CRT+brachytherapy; extended field RT if paraaortic LN+; consolidation pembrolizumab (KEYNOTE-A18)", os_5yr_approx: "~35-50%", guideline_source: "FIGO 2018; NCCN Cervical v1.2024" },
    { cancer_type: "Cervical", subtype_label: "Cervical Carcinoma (SCC/Adeno)", staging_system: "FIGO 2018", stage_label: "FIGO IV", tnm_criteria: "IVA: bladder/rectum invasion; IVB: distant mets", risk_system: "PD-L1 / dMMR / HER2", risk_category: "Metastatic", risk_criteria: "Cisplatin+paclitaxel+bevacizumab+pembrolizumab (KEYNOTE-826, PD-L1 CPS>=1); dMMR: pembro", os_5yr_approx: "~15-20%", guideline_source: "FIGO 2018; NCCN Cervical v1.2024" },
    // BLADDER
    { cancer_type: "Bladder", subtype_label: "Urothelial Carcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage 0 (NMIBC)", tnm_criteria: "Ta (papillary, non-invasive); Tis (CIS flat); T1 (lamina propria)", risk_system: "FGFR3 / PD-L1", risk_category: "Low / High Grade NMIBC", risk_criteria: "TURBT + intravesical BCG (high grade/CIS/T1); BCG-naive CIS: nadofaragene firadenovec", os_5yr_approx: ">85% (CSS)", guideline_source: "AJCC 8th; NCCN Bladder v4.2024" },
    { cancer_type: "Bladder", subtype_label: "Urothelial Carcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage II (MIBC)", tnm_criteria: "T2a-b N0 M0 (muscle invasion)", risk_system: "FGFR3 / PD-L1", risk_category: "Muscle-Invasive", risk_criteria: "Neoadjuvant cisplatin-based chemo (GC or ddMVAC) -> radical cystectomy; bladder-sparing TMT in selected", os_5yr_approx: "~55-65%", guideline_source: "AJCC 8th; NCCN Bladder v4.2024" },
    { cancer_type: "Bladder", subtype_label: "Urothelial Carcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage III-IV", tnm_criteria: "T3-4 / N1-3 / M1", risk_system: "FGFR3 / PD-L1", risk_category: "Locally Advanced / Metastatic", risk_criteria: "1L cisplatin-eligible: GC+avelumab maintenance; cisplatin-ineligible: pembrolizumab; FGFR3 altered: erdafitinib", os_5yr_approx: "~15-25%", guideline_source: "AJCC 8th; NCCN Bladder v4.2024" },
    // KIDNEY
    { cancer_type: "Kidney", subtype_label: "Renal Cell Carcinoma (ccRCC)", staging_system: "AJCC 8th Ed", stage_label: "Stage I-II", tnm_criteria: "IA: <=4cm; IB: 4-7cm; II: >7cm (all confined to kidney)", risk_system: null, risk_category: "Localised", risk_criteria: "Partial nephrectomy (preferred); radical nephrectomy; active surveillance for small renal masses", os_5yr_approx: "~81-93%", guideline_source: "AJCC 8th; NCCN Kidney v2.2024" },
    { cancer_type: "Kidney", subtype_label: "Renal Cell Carcinoma (ccRCC)", staging_system: "AJCC 8th Ed", stage_label: "Stage III", tnm_criteria: "T3 (renal vein/IVC) or N1 (regional LN+)", risk_system: "IMDC Criteria", risk_category: "Localised-Advanced", risk_criteria: "Nephrectomy; adjuvant pembrolizumab x1yr (KEYNOTE-564)", os_5yr_approx: "~53%", guideline_source: "AJCC 8th; NCCN Kidney v2.2024" },
    { cancer_type: "Kidney", subtype_label: "Renal Cell Carcinoma (ccRCC)", staging_system: "AJCC 8th Ed", stage_label: "Stage IV (Metastatic)", tnm_criteria: "T4 (Gerota's fascia) or M1", risk_system: "IMDC Criteria", risk_category: "0=Favourable;1-2=Intermediate;3-6=Poor", risk_criteria: "Favourable: sunitinib or pembro+axitinib or cabozantinib+nivo; Intermediate/Poor: nivo+ipi or pembro+axitinib or cabo+nivo", os_5yr_approx: "~12%", guideline_source: "AJCC 8th; IMDC; NCCN Kidney v2.2024" },
    // THYROID
    { cancer_type: "Thyroid", subtype_label: "Differentiated TC (PTC/FTC)", staging_system: "AJCC 8th Ed", stage_label: "Stage I", tnm_criteria: "PTC <55yr: any T any N M0; PTC >=55yr: T1-2 N0-1 M0", risk_system: "ATA Risk (Recurrence)", risk_category: "ATA Low Risk", risk_criteria: "Thyroidectomy +/- RAI; TSH suppression; excellent prognosis", os_5yr_approx: ">98%", guideline_source: "AJCC 8th; ATA 2015; NCCN Thyroid v2.2024" },
    { cancer_type: "Thyroid", subtype_label: "Differentiated TC (PTC/FTC)", staging_system: "AJCC 8th Ed", stage_label: "Stage II", tnm_criteria: "PTC >=55yr: T1-4 any N M0 except T3b-4b; OR PTC <55yr: any T any N M1", risk_system: "ATA Risk / BRAF V600E", risk_category: "ATA Intermediate Risk", risk_criteria: "Total thyroidectomy+RAI if high recurrence risk; lenvatinib/sorafenib for RAI-refractory", os_5yr_approx: "~85-93%", guideline_source: "AJCC 8th; ATA 2015; NCCN Thyroid v2.2024" },
    { cancer_type: "Thyroid", subtype_label: "Anaplastic Thyroid Cancer", staging_system: "AJCC 8th Ed (IVA-IVC)", stage_label: "Stage IVA-C", tnm_criteria: "IVA: confined to thyroid; IVB: gross extranodal extension; IVC: distant mets (all ATC=Stage IV)", risk_system: "BRAF V600E / RET", risk_category: "Unresectable / Metastatic", risk_criteria: "BRAF V600E: dabrafenib+trametinib; non-BRAF: multiagent chemo+RT (poor prognosis)", os_5yr_approx: "<10% (1yr)", guideline_source: "AJCC 8th; NCCN Thyroid v2.2024" },
    // MELANOMA
    { cancer_type: "Melanoma", subtype_label: "Cutaneous Melanoma", staging_system: "AJCC 8th Ed", stage_label: "Stage IA-IB", tnm_criteria: "T1a (<0.8mm, no ulcer); T1b (ulcerated or mitosis); T2a (0.8-2mm, no ulcer) - N0 M0", risk_system: "BRAF V600 / LDH", risk_category: "Localised Low Risk", risk_criteria: "Wide local excision; SLNB if T1b or >=T2; no adjuvant therapy for Stage I", os_5yr_approx: "~97-98%", guideline_source: "AJCC 8th; NCCN Melanoma v3.2024" },
    { cancer_type: "Melanoma", subtype_label: "Cutaneous Melanoma", staging_system: "AJCC 8th Ed", stage_label: "Stage II", tnm_criteria: "T2b-4b N0 M0 (2-4mm with/without ulceration, or >4mm)", risk_system: "BRAF V600", risk_category: "Intermediate-High Risk", risk_criteria: "Adjuvant pembrolizumab x1yr (KEYNOTE-716); BRAF+: dabrafenib+trametinib (COMBI-AD)", os_5yr_approx: "~65-80%", guideline_source: "AJCC 8th; NCCN Melanoma v3.2024" },
    { cancer_type: "Melanoma", subtype_label: "Cutaneous Melanoma", staging_system: "AJCC 8th Ed", stage_label: "Stage III", tnm_criteria: "Any T N1-3 M0 (regional LN, microsatellites, in-transit mets)", risk_system: "BRAF V600 / PD-L1", risk_category: "Regional", risk_criteria: "Adjuvant nivo or pembro; BRAF+: dabrafenib+trametinib; consider CLND vs observation post SLNB", os_5yr_approx: "~40-60%", guideline_source: "AJCC 8th; NCCN Melanoma v3.2024" },
    { cancer_type: "Melanoma", subtype_label: "Cutaneous Melanoma", staging_system: "AJCC 8th Ed", stage_label: "Stage IV", tnm_criteria: "Any T, Any N, M1a (skin/SQ/non-RP LN)/M1b (lung)/M1c (other visceral)/M1d (CNS)", risk_system: "BRAF V600 / PD-L1 / LDH", risk_category: "Metastatic", risk_criteria: "1L: nivo+ipi (BRAF wt or BRAF+); BRAF+: dabrafenib+trametinib; LDH up + BRAF mut: consider BRAF-i first", os_5yr_approx: "~25-35%", guideline_source: "AJCC 8th; NCCN Melanoma v3.2024" },
    // HEAD & NECK
    { cancer_type: "Head & Neck", subtype_label: "HNSCC (Oral/Oropharynx/Larynx)", staging_system: "AJCC 8th Ed", stage_label: "Stage I-II", tnm_criteria: "T1-2 N0 M0; Oropharynx HPV+: T1-2 N0-1 M0", risk_system: "HPV / p16 / PD-L1", risk_category: "Early", risk_criteria: "Surgery or definitive RT; HPV+ OP: de-intensification protocols (ECOG-E3311)", os_5yr_approx: "~80-90%", guideline_source: "AJCC 8th; NCCN HNSCC v2.2024" },
    { cancer_type: "Head & Neck", subtype_label: "HNSCC (Oral/Oropharynx/Larynx)", staging_system: "AJCC 8th Ed", stage_label: "Stage III-IVA", tnm_criteria: "T3-4a or N1-2 M0 (HPV- or AJCC 8th HPV+ Stage III-IV)", risk_system: "HPV / PD-L1 / EGFR", risk_category: "Locally Advanced", risk_criteria: "Concurrent CRT (cisplatin 100mg/m2 q3w or 40mg/m2 weekly)+EBRT; consider cetuximab (cisplatin-unfit)", os_5yr_approx: "~45-65%", guideline_source: "AJCC 8th; NCCN HNSCC v2.2024" },
    { cancer_type: "Head & Neck", subtype_label: "HNSCC (Oral/Oropharynx/Larynx)", staging_system: "AJCC 8th Ed", stage_label: "Stage IVB-IVC", tnm_criteria: "T4b (unresectable) or N3 or M1", risk_system: "PD-L1 CPS / EGFR", risk_category: "Metastatic", risk_criteria: "1L: pembro monotherapy (PD-L1 CPS>=1); CPS<1: pembro+chemo; cetuximab biosimilar available India", os_5yr_approx: "~15%", guideline_source: "AJCC 8th; NCCN HNSCC v2.2024" },
    // ESOPHAGEAL
    { cancer_type: "Esophageal", subtype_label: "Esophageal SCC / Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage I", tnm_criteria: "T1a (lamina propria/muscularis mucosae) or T1b (submucosa) N0 M0", risk_system: "HER2 / PD-L1", risk_category: "Early", risk_criteria: "Endoscopic resection (ESD/EMR) for T1a; esophagectomy for T1b", os_5yr_approx: "~70-80%", guideline_source: "AJCC 8th; NCCN Esophageal v4.2024" },
    { cancer_type: "Esophageal", subtype_label: "Esophageal SCC / Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage II-III", tnm_criteria: "T2-3 N0-1 / T1-3 N2 M0", risk_system: "HER2 / PD-L1", risk_category: "Locally Advanced", risk_criteria: "Adeno GEJ: perioperative FLOT or neoadj CROSS -> esophagectomy; SCC: definitive CRT or CROSS", os_5yr_approx: "~25-45%", guideline_source: "AJCC 8th; NCCN Esophageal v4.2024" },
    { cancer_type: "Esophageal", subtype_label: "Esophageal SCC / Adenocarcinoma", staging_system: "AJCC 8th Ed", stage_label: "Stage IV", tnm_criteria: "Any T Any N M1 (including cervical LN for thoracic primary)", risk_system: "HER2 / PD-L1 / dMMR", risk_category: "Metastatic", risk_criteria: "1L: HER2+: pembro+trastuzumab+FP; HER2-: nivo+FOLFOX or pembro+FP", os_5yr_approx: "~6%", guideline_source: "AJCC 8th; NCCN Esophageal v4.2024" },
    // CNS
    { cancer_type: "CNS", subtype_label: "Glioma / GBM", staging_system: "WHO CNS 2021", stage_label: "Grade 1-2 (Diffuse Low-Grade)", tnm_criteria: "IDH-mutant astrocytoma gr 1-2 or oligodendroglioma gr 2; well-differentiated; slow growing", risk_system: "IDH / 1p19q / MGMT", risk_category: "Low Grade IDH-mutant", risk_criteria: "Maximal safe resection; IDH-mut oligo: PCV chemo or RT+chemo; IDH-astro: RT if high-risk", os_5yr_approx: "~80-90% (10yr oligo)", guideline_source: "WHO CNS 2021; NCCN CNS v1.2024" },
    { cancer_type: "CNS", subtype_label: "Glioma / GBM", staging_system: "WHO CNS 2021", stage_label: "Grade 3 (Anaplastic)", tnm_criteria: "IDH-mutant or wt astrocytoma gr 3; anaplastic oligodendroglioma gr 3 (1p19q co-del)", risk_system: "IDH / 1p19q / MGMT", risk_category: "High Grade IDH-mut or wt", risk_criteria: "Resection -> RT+concurrent+adjuvant temozolomide; anaplastic oligo: RT+PCV", os_5yr_approx: "~20-40%", guideline_source: "WHO CNS 2021; NCCN CNS v1.2024" },
    { cancer_type: "CNS", subtype_label: "GBM (Grade 4)", staging_system: "WHO CNS 2021", stage_label: "Grade 4 (GBM IDH-wt/IDH-mut gr4)", tnm_criteria: "IDH-wt GBM: EGFR amp or TERT mut or +7/-10 pattern; IDH-mut Grade 4 astrocytoma", risk_system: "MGMT promoter methylation / EGFRvIII", risk_category: "GBM - Methylated/Unmethylated MGMT", risk_criteria: "Stupp protocol: temozolomide+RT (60Gy); MGMT-methylated: higher benefit; TTF (EF-14)", os_5yr_approx: "~5-7% (MGMT-meth ~16%)", guideline_source: "WHO CNS 2021; NCCN CNS v1.2024; EF-14" },
    // LEUKEMIA
    { cancer_type: "Leukemia", subtype_label: "AML", staging_system: "ELN 2022", stage_label: "ELN Favourable", tnm_criteria: "t(8;21); inv(16)/t(16;16); NPM1 mut without FLT3-ITD; CEBPA bZIP in-frame mut", risk_system: "ELN 2022", risk_category: "Favourable", risk_criteria: "Standard 7+3 induction -> consolidation HiDAC x3-4 cycles; HSCT not indicated in CR1", os_5yr_approx: "~65-70% (5yr)", guideline_source: "ELN 2022; NCCN AML v3.2024" },
    { cancer_type: "Leukemia", subtype_label: "AML", staging_system: "ELN 2022", stage_label: "ELN Intermediate", tnm_criteria: "NPM1 mut + FLT3-ITD; t(9;11); cytogenetically normal, no defined favourable or adverse", risk_system: "ELN 2022 / FLT3 / IDH1/2", risk_category: "Intermediate", risk_criteria: "7+3 +/- midostaurin if FLT3+; consider allo-HSCT in CR1", os_5yr_approx: "~40-50% (5yr)", guideline_source: "ELN 2022; NCCN AML v3.2024" },
    { cancer_type: "Leukemia", subtype_label: "AML", staging_system: "ELN 2022", stage_label: "ELN Adverse", tnm_criteria: "t(6;9); t(v;11q23.3) except t(9;11); inv(3); complex karyotype (>=3 abn); monosomal karyotype; TP53 mut", risk_system: "ELN 2022 / TP53 / FLT3", risk_category: "Adverse", risk_criteria: "7+3 +/- venetoclax; FLT3+: midostaurin; allo-HSCT in CR1 strongly recommended", os_5yr_approx: "~10-20% (5yr)", guideline_source: "ELN 2022; NCCN AML v3.2024" },
    { cancer_type: "Leukemia", subtype_label: "ALL (B-cell/T-cell)", staging_system: "NCI/NOPHO Risk Groups", stage_label: "Standard Risk (B-ALL)", tnm_criteria: "WBC <30x10^9/L (B-ALL) / <100x10^9/L (T-ALL); age <35; no adverse cytogenetics; CR within 4 weeks", risk_system: "Ph / BCR-ABL1 / IKZF1 / TP53", risk_category: "Standard Risk", risk_criteria: "BFM-based induction (VDLP) -> consolidation -> maintenance; CNS prophylaxis", os_5yr_approx: "~70-80% (adults)", guideline_source: "NCCN ALL v2.2024" },
    { cancer_type: "Leukemia", subtype_label: "ALL (B-cell/T-cell)", staging_system: "NCI/NOPHO Risk Groups", stage_label: "High Risk / Ph+ ALL", tnm_criteria: "WBC >30x10^9/L; Ph+ (BCR-ABL1 fused); IKZF1 deletion; MRD+; age >35; delayed CR", risk_system: "Ph / BCR-ABL1 / MRD", risk_category: "High Risk / Ph+", risk_criteria: "Ph+: dasatinib or ponatinib+steroids -> CR -> allo-HSCT; Ph-: blinatumomab-augmented chemo; CAR-T (relapsed)", os_5yr_approx: "~30-50%", guideline_source: "NCCN ALL v2.2024" },
    { cancer_type: "Leukemia", subtype_label: "CLL / SLL", staging_system: "Rai / CLL-IPI", stage_label: "Rai Stage 0-I (CLL-IPI Low)", tnm_criteria: "Rai 0: lymphocytosis only; Rai I: lymphadenopathy; CLL-IPI 0-1: TP53 wt, IGHV mut, no del(17p)/del(11q)", risk_system: "CLL-IPI (TP53/del17p/del11q/IGHV/b2M/age)", risk_category: "Low Risk", risk_criteria: "Observe; treatment at progression (Binet B/C or symptomatic)", os_5yr_approx: "~93% (5yr)", guideline_source: "CLL-IPI; NCCN CLL v1.2024" },
    { cancer_type: "Leukemia", subtype_label: "CLL / SLL", staging_system: "Rai / CLL-IPI", stage_label: "Rai II-IV (CLL-IPI Intermediate-High)", tnm_criteria: "Rai II: splenomegaly; III: Hb <11; IV: platelets <100; del(17p)/TP53 mut = Very High", risk_system: "TP53 / del(17p) / IGHV / del(11q)", risk_category: "Intermediate / High / Very High", risk_criteria: "BTK inhibitor +/- venetoclax; del(17p)/TP53: avoid chemoimmunotherapy; venetoclax+obinutuzumab (CLL14)", os_5yr_approx: "~55-75% (5yr)", guideline_source: "CLL-IPI; NCCN CLL v1.2024" },
    { cancer_type: "Leukemia", subtype_label: "CML (BCR-ABL1+)", staging_system: "Sokal / ELTS Score", stage_label: "Chronic Phase", tnm_criteria: "WBC elevated, splenomegaly; blasts <10%; BCR-ABL1 present", risk_system: "Sokal / ELTS / BCR-ABL1 kinetics", risk_category: "Low / Intermediate / High", risk_criteria: "Imatinib; dasatinib or nilotinib (2nd gen) if high Sokal or intolerant; target: MMR <=12m", os_5yr_approx: "~90% (10yr)", guideline_source: "ELN CML 2020; NCCN CML v1.2024" },
    { cancer_type: "Leukemia", subtype_label: "CML (BCR-ABL1+)", staging_system: "WHO 2022", stage_label: "Accelerated / Blast Phase", tnm_criteria: "AP: blasts 10-19%, basophils >=20%, new chromosomal abnormalities; BP: blasts >=20%", risk_system: "T315I / Compound Mutations", risk_category: "Accelerated / Blast Phase", risk_criteria: "AP: escalate TKI; BP lymphoid: TKI+ALL-type chemo; T315I: ponatinib or asciminib; allo-HSCT in CP2", os_5yr_approx: "~30-50% (AP); <20% (BP)", guideline_source: "ELN CML 2020; NCCN CML v1.2024" },
    // LYMPHOMA
    { cancer_type: "Lymphoma", subtype_label: "Hodgkin Lymphoma (cHL)", staging_system: "Lugano 2014 (Ann Arbor)", stage_label: "Stage I-II Favourable", tnm_criteria: "I: single LN region/single extranodal; II: >=2 LN regions same side of diaphragm; no B symptoms; no bulky", risk_system: "Deauville PET / International Prognostic Score", risk_category: "Favourable", risk_criteria: "ABVD x2 + involved-field RT 20Gy; or ABVD x4 without RT (interim PET-guided)", os_5yr_approx: "~95%", guideline_source: "Lugano 2014; ESMO HL 2018; NCCN HL v2.2024" },
    { cancer_type: "Lymphoma", subtype_label: "Hodgkin Lymphoma (cHL)", staging_system: "Lugano 2014 (Ann Arbor)", stage_label: "Stage I-II Unfavourable", tnm_criteria: "Bulky disease (>=10cm) OR B symptoms OR >=3 LN regions OR ESR >50", risk_system: "Deauville PET / IPS", risk_category: "Unfavourable", risk_criteria: "ABVD x4 + RT 30Gy; or BV-AVD (ECHELON-1) preferred over ABVD in fit patients", os_5yr_approx: "~85%", guideline_source: "Lugano 2014; NCCN HL v2.2024" },
    { cancer_type: "Lymphoma", subtype_label: "Hodgkin Lymphoma (cHL)", staging_system: "Lugano 2014 (Ann Arbor)", stage_label: "Stage III-IV", tnm_criteria: "III: both sides of diaphragm (+/-spleen); IV: extranodal organ involvement", risk_system: "IPS (7 factors)", risk_category: "IPS 0-2=Low;3-4=Intermediate;5-7=High", risk_criteria: "BV-AVD x6 cycles (ECHELON-1); interim PET at cycle 2/4 guides response", os_5yr_approx: "~75-80%", guideline_source: "Lugano 2014; ECHELON-1; NCCN HL v2.2024" },
    { cancer_type: "Lymphoma", subtype_label: "DLBCL (Aggressive B-cell)", staging_system: "Lugano 2014", stage_label: "Stage I-II (Limited)", tnm_criteria: "I: single region/extranodal; II: 2+ regions, same side of diaphragm", risk_system: "IPI / R-IPI / MYC/BCL2/BCL6 DH", risk_category: "IPI 0 (R-IPI Very Good)", risk_criteria: "R-CHOP x3-4 + involved-site RT; R-CHOP x6 without RT acceptable", os_5yr_approx: "~90%", guideline_source: "Lugano 2014; NCCN DLBCL v2.2024" },
    { cancer_type: "Lymphoma", subtype_label: "DLBCL (Aggressive B-cell)", staging_system: "Lugano 2014", stage_label: "Stage III-IV (Advanced)", tnm_criteria: "III: bilateral diaphragm; IV: extranodal organ (bone marrow, liver, CNS, lung)", risk_system: "IPI / DH status / Cell of Origin (COO)", risk_category: "IPI 0-1(Low)/2-3(Intermediate)/4-5(High)", risk_criteria: "R-CHOP x6; DH lymphoma: dose-adjusted EPOCH-R; polatuzumab-R-CHP (POLARIX, preferred)", os_5yr_approx: "~60-75% (IPI 0-2)", guideline_source: "Lugano 2014; POLARIX; NCCN DLBCL v2.2024" },
    { cancer_type: "Lymphoma", subtype_label: "Follicular Lymphoma (Grade 1-3A)", staging_system: "Lugano 2014", stage_label: "Stage I-II", tnm_criteria: "Limited: single or two contiguous LN regions (rare at diagnosis - <20%)", risk_system: "FLIPI / FLIPI2 / m7-FLIPI", risk_category: "Low FLIPI", risk_criteria: "Involved-site RT 24Gy curative intent; or rituximab monotherapy; or observe", os_5yr_approx: ">90% (10yr)", guideline_source: "Lugano 2014; NCCN FL v3.2024" },
    { cancer_type: "Lymphoma", subtype_label: "Follicular Lymphoma (Grade 1-3A)", staging_system: "Lugano 2014", stage_label: "Stage III-IV (Advanced)", tnm_criteria: "III: bilateral diaphragm; IV: extranodal; most FL presents Stage III-IV", risk_system: "FLIPI (5 adverse factors)", risk_category: "FLIPI 0-1=Low;2=Int;3-5=High", risk_criteria: "TBNL: observe (asymptomatic, low burden); treat: R-bendamustine (StiL) or BR; consolidate with lenalidomide-R", os_5yr_approx: "~75-80% (10yr)", guideline_source: "Lugano 2014; NCCN FL v3.2024" },
    // MYELOMA
    { cancer_type: "Myeloma", subtype_label: "Multiple Myeloma", staging_system: "R-ISS (Revised ISS)", stage_label: "R-ISS Stage I", tnm_criteria: "ISS I (b2M <3.5mg/L, Alb >=3.5g/dL) + standard-risk cytogenetics + LDH normal", risk_system: "R-ISS / FISH (del17p/t(4;14)/t(14;16))", risk_category: "Standard Risk", risk_criteria: "VRd x4 cycles -> ASCT (transplant-eligible) -> lenalidomide maintenance; Transplant-ineligible: Dara-VRd or VRd", os_5yr_approx: "~82% (5yr)", guideline_source: "R-ISS; IMWG; NCCN MM v5.2024" },
    { cancer_type: "Myeloma", subtype_label: "Multiple Myeloma", staging_system: "R-ISS (Revised ISS)", stage_label: "R-ISS Stage II", tnm_criteria: "Neither Stage I nor III (intermediate risk profile)", risk_system: "R-ISS / FISH / LDH", risk_category: "Intermediate Risk", risk_criteria: "Dara-VRd (PERSEUS) x4 induction -> ASCT (TE) -> maintenance R or Dara-R", os_5yr_approx: "~62% (5yr)", guideline_source: "R-ISS; NCCN MM v5.2024" },
    { cancer_type: "Myeloma", subtype_label: "Multiple Myeloma", staging_system: "R-ISS (Revised ISS)", stage_label: "R-ISS Stage III", tnm_criteria: "ISS III (b2M >=5.5mg/L) + high-risk cytogenetics [del(17p), t(4;14), t(14;16)] OR elevated LDH", risk_system: "R-ISS / del(17p) / t(4;14) / t(14;16)", risk_category: "High Risk", risk_criteria: "Dara-VRd with early ASCT; consider carfilzomib-containing regimen; MRD negativity goal; maintenance Dara-R or KRd", os_5yr_approx: "~40% (5yr)", guideline_source: "R-ISS; NCCN MM v5.2024" },
];

// ---------------------------------------------------------------------------
// docx Section 11 - configurable clinical thresholds
// ---------------------------------------------------------------------------
const CLINICAL_PARAMETERS = [
    { parameter_key: "er_pr_positivity_cutoff_pct", value: "1", unit: "%", guideline_source: "ASCO/CAP 2020", description: "ER/PR positivity cutoff - used in Algorithm E2 hr_positive calculation" },
    { parameter_key: "ki67_luminal_ab_cutoff_pct", value: "14", unit: "%", guideline_source: "St Gallen Consensus 2013", description: "Ki-67 cutoff distinguishing Luminal A (<) from Luminal B HER2- (>=) - Algorithm E2" },
    { parameter_key: "her2_fish_ratio_cutoff", value: "2.0", unit: "ratio", guideline_source: "ASCO/CAP 2018", description: "HER2:CEP17 FISH ratio amplified cutoff - Algorithm E1" },
    { parameter_key: "her2_fish_avg_copy_cutoff", value: "6.0", unit: "signals/cell", guideline_source: "ASCO/CAP 2018", description: "HER2 FISH average copy number amplified cutoff - Algorithm E1" },
    { parameter_key: "pdl1_tps_low_cutoff_pct", value: "1", unit: "%", guideline_source: "KEYNOTE-024/189", description: "PD-L1 TPS lower bound for any IO eligibility" },
    { parameter_key: "pdl1_tps_high_cutoff_pct", value: "50", unit: "%", guideline_source: "KEYNOTE-024/189", description: "PD-L1 TPS threshold for pembrolizumab monotherapy eligibility (NSCLC)" },
    { parameter_key: "tmb_high_cutoff", value: "10", unit: "mutations/Mb", guideline_source: "KEYNOTE-158; FDA tumour-agnostic label", description: "TMB-High cutoff for pan-tumour pembrolizumab eligibility" },
    { parameter_key: "tnbc_germline_referral_age_years", value: "50", unit: "years", guideline_source: "NCCN Breast 2024", description: "Age threshold (<=) for TNBC germline referral flag - Algorithm E4" },
];

async function seedCancerTypesAndSubtypes() {
    console.log("Seeding cancer_types and cancer_subtypes...");

    const typeOrder: string[] = [];
    const typeDefaults = new Map<string, { icd10: string; icd_o3_topography: string; staging_system: string }>();
    const typeTargets = new Map<string, Set<string>>();

    for (const row of CANCER_REFERENCE) {
        if (!typeDefaults.has(row.cancer_type)) {
            typeOrder.push(row.cancer_type);
            typeDefaults.set(row.cancer_type, {
                icd10: row.icd10,
                icd_o3_topography: row.icd_o3_topography,
                staging_system: row.staging_system,
            });
            typeTargets.set(row.cancer_type, new Set());
        }
        row.druggable_targets.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => typeTargets.get(row.cancer_type)!.add(t));
    }

    const cancerTypeIds = new Map<string, string>();

    for (const typeName of typeOrder) {
        const defaults = typeDefaults.get(typeName)!;
        const targets = Array.from(typeTargets.get(typeName)!).join(", ");

        const existing = await prisma.cancer_types.findUnique({ where: { cancer_type: typeName } });
        let cancerTypeId: string;

        if (existing) {
            cancerTypeId = existing.cancer_type_id;
            await prisma.cancer_types.update({
                where: { cancer_type_id: cancerTypeId },
                data: {
                    icd10: defaults.icd10,
                    icd_o3_topography: defaults.icd_o3_topography,
                    staging_system: defaults.staging_system,
                    druggable_targets: targets,
                },
            });
        } else {
            cancerTypeId = await prisma.$transaction((tx) => generateId(tx, "CANCER_TYPE"));
            await prisma.cancer_types.create({
                data: {
                    cancer_type_id: cancerTypeId,
                    cancer_type: typeName,
                    icd10: defaults.icd10,
                    icd_o3_topography: defaults.icd_o3_topography,
                    staging_system: defaults.staging_system,
                    druggable_targets: targets,
                },
            });
        }

        cancerTypeIds.set(typeName, cancerTypeId);
    }

    console.log(`  ${typeOrder.length} cancer_types ready`);

    let subtypeCount = 0;
    for (const row of CANCER_REFERENCE) {
        const cancerTypeId = cancerTypeIds.get(row.cancer_type)!;

        const existing = await prisma.cancer_subtypes.findFirst({
            where: { cancer_type_id: cancerTypeId, subtype_name: row.subtype_name },
        });

        if (existing) {
            await prisma.cancer_subtypes.update({
                where: { subtype_id: existing.subtype_id },
                data: { icd_o3_morphology: row.icd_o3_morphology, icd10_subtype: row.icd10 },
            });
        } else {
            const subtypeId = await prisma.$transaction((tx) => generateId(tx, "CANCER_SUBTYPE"));
            await prisma.cancer_subtypes.create({
                data: {
                    subtype_id: subtypeId,
                    cancer_type_id: cancerTypeId,
                    subtype_name: row.subtype_name,
                    icd_o3_morphology: row.icd_o3_morphology,
                    icd10_subtype: row.icd10,
                },
            });
        }
        subtypeCount++;
    }

    console.log(`  ${subtypeCount} cancer_subtypes ready`);
    return cancerTypeIds;
}

async function seedMolecularSubtypes(cancerTypeIds: Map<string, string>) {
    console.log("Seeding molecular_subtypes (Breast PAM50 surrogate)...");
    const breastId = cancerTypeIds.get("Breast");
    if (!breastId) throw new Error("Breast cancer_type not found - run seedCancerTypesAndSubtypes first");

    for (const row of MOLECULAR_SUBTYPES) {
        const existing = await prisma.molecular_subtypes.findFirst({
            where: { cancer_type_id: breastId, subtype_name: row.subtype_name },
        });

        if (existing) {
            await prisma.molecular_subtypes.update({
                where: { mol_sub_id: existing.mol_sub_id },
                data: { er_rule: row.er_rule, pr_rule: row.pr_rule, her2_rule: row.her2_rule, ki67_threshold: row.ki67_threshold, colour_hex: row.colour_hex, badge_label: row.badge_label },
            });
        } else {
            const molSubId = await prisma.$transaction((tx) => generateId(tx, "MOLECULAR_SUBTYPE"));
            await prisma.molecular_subtypes.create({
                data: { mol_sub_id: molSubId, cancer_type_id: breastId, ...row },
            });
        }
    }
    console.log(`  ${MOLECULAR_SUBTYPES.length} molecular_subtypes ready`);
}

async function seedBiomarkerTests() {
    console.log("Seeding biomarker_tests...");
    for (const row of BIOMARKER_TESTS) {
        const existing = await prisma.biomarker_tests.findFirst({ where: { biomarker_name: row.biomarker_name } });
        if (existing) {
            await prisma.biomarker_tests.update({ where: { biomarker_id: existing.biomarker_id }, data: row });
        } else {
            const biomarkerId = await prisma.$transaction((tx) => generateId(tx, "BIOMARKER_TEST"));
            await prisma.biomarker_tests.create({ data: { biomarker_id: biomarkerId, ...row } });
        }
    }
    console.log(`  ${BIOMARKER_TESTS.length} biomarker_tests ready`);
}

async function seedStagingReference(cancerTypeIds: Map<string, string>) {
    console.log("Seeding staging_reference...");
    let count = 0;
    for (const row of STAGING_REFERENCE) {
        const cancerTypeId = cancerTypeIds.get(row.cancer_type);
        if (!cancerTypeId) {
            console.warn(`  skipping staging row - unknown cancer_type "${row.cancer_type}"`);
            continue;
        }

        const existing = await prisma.staging_reference.findFirst({
            where: { cancer_type_id: cancerTypeId, stage_label: row.stage_label, subtype_label: row.subtype_label },
        });

        const data = {
            cancer_type_id: cancerTypeId,
            subtype_label: row.subtype_label,
            staging_system: row.staging_system,
            stage_label: row.stage_label,
            tnm_criteria: row.tnm_criteria,
            risk_system: row.risk_system,
            risk_category: row.risk_category,
            risk_criteria: row.risk_criteria,
            os_5yr_approx: row.os_5yr_approx,
            guideline_source: row.guideline_source,
        };

        if (existing) {
            await prisma.staging_reference.update({ where: { stage_ref_id: existing.stage_ref_id }, data });
        } else {
            const stageRefId = await prisma.$transaction((tx) => generateId(tx, "STAGING_REFERENCE"));
            await prisma.staging_reference.create({ data: { stage_ref_id: stageRefId, ...data } });
        }
        count++;
    }
    console.log(`  ${count} staging_reference rows ready`);
}

async function seedClinicalParameters() {
    console.log("Seeding clinical_parameter...");
    for (const row of CLINICAL_PARAMETERS) {
        await prisma.clinical_parameter.upsert({
            where: { parameter_key: row.parameter_key },
            update: { value: row.value, unit: row.unit, guideline_source: row.guideline_source, description: row.description },
            create: row,
        });
    }
    console.log(`  ${CLINICAL_PARAMETERS.length} clinical_parameter rows ready`);
}

export async function seedOncologyReferenceData() {
    const cancerTypeIds = await seedCancerTypesAndSubtypes();
    await seedMolecularSubtypes(cancerTypeIds);
    await seedBiomarkerTests();
    await seedStagingReference(cancerTypeIds);
    await seedClinicalParameters();
    console.log("Oncology reference data seeding complete.");
}

if (require.main === module) {
    seedOncologyReferenceData()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
