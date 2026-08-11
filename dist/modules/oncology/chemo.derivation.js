"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveHer2Positive = deriveHer2Positive;
exports.deriveBreastMolecularSubtype = deriveBreastMolecularSubtype;
exports.derivePdl1ScoreType = derivePdl1ScoreType;
exports.deriveLynchSyndromeFlag = deriveLynchSyndromeFlag;
exports.deriveGermlineReferralFlag = deriveGermlineReferralFlag;
exports.deriveSuggestedTherapy = deriveSuggestedTherapy;
exports.deriveOncologyFields = deriveOncologyFields;
const oncology_constants_1 = require("./oncology.constants");
// ---------------------------------------------------------------------------
// Algorithm E1 - HER2 Final Status (design guide Section 7)
// ---------------------------------------------------------------------------
function deriveHer2Positive(ihc, params) {
    const score = (0, oncology_constants_1.her2IhcScore)(ihc.her2_ihc);
    if (!score) {
        return null;
    }
    if (score === "3+") {
        return true;
    }
    if (score === "0" || score === "1+") {
        return false;
    }
    if (score === "2+") {
        const fish = (ihc.her2_fish ?? "").trim().toLowerCase();
        if (fish.startsWith("not amplified")) {
            return false;
        }
        if (fish.startsWith("amplified")) {
            return true;
        }
        // FISH not yet resolved (Pending/Not Done) - V-01 should already have
        // blocked the save, but derivation must never guess a status that
        // hasn't actually been confirmed. Fall back to the numeric ratio/copy
        // only if they were entered without a categorical FISH call.
        if (ihc.her2_fish_ratio != null && ihc.her2_fish_ratio >= params.her2_fish_ratio_cutoff) {
            return true;
        }
        if (ihc.her2_avg_copy != null && ihc.her2_avg_copy >= params.her2_fish_avg_copy_cutoff) {
            return true;
        }
        return null;
    }
    return null;
}
// ---------------------------------------------------------------------------
// Algorithm E2 - Breast Molecular Subtype (PAM50 surrogate, St Gallen 2013)
// Only runs for cancer_type = Breast; returns null for everything else.
// ---------------------------------------------------------------------------
function deriveBreastMolecularSubtype(cancerType, ihc, params) {
    if (cancerType !== "Breast") {
        return null;
    }
    const erPositive = (0, oncology_constants_1.isPositiveLike)(ihc.er_status) && (ihc.er_percent ?? 0) >= params.er_pr_positivity_cutoff_pct;
    const prPositive = (0, oncology_constants_1.isPositiveLike)(ihc.pr_status) && (ihc.pr_percent ?? 0) >= params.er_pr_positivity_cutoff_pct;
    const hrPositive = erPositive || prPositive;
    const her2Positive = deriveHer2Positive(ihc, params);
    if (her2Positive === null) {
        // HER2 status unresolved (e.g. IHC 2+ awaiting FISH) - subtype cannot
        // be safely determined yet, per the design guide's explicit note on
        // Algorithm E2: "wait for FISH before calculating."
        return null;
    }
    if (!hrPositive && !her2Positive) {
        return "TNBC";
    }
    if (!hrPositive && her2Positive) {
        return "HER2-Enriched";
    }
    if (hrPositive && her2Positive) {
        return "Luminal B HER2+";
    }
    // hrPositive && !her2Positive
    if (ihc.ki67_percent === null || ihc.ki67_percent === undefined) {
        return "Luminal (Ki-67 pending)";
    }
    return ihc.ki67_percent < params.ki67_luminal_ab_cutoff_pct ? "Luminal A" : "Luminal B HER2-";
}
// ---------------------------------------------------------------------------
// Algorithm E3 - PD-L1 Score Type Auto-Fill
// ---------------------------------------------------------------------------
function derivePdl1ScoreType(clone, cancerType, isTnbc) {
    if ((0, oncology_constants_1.isNotDoneOrPending)(clone)) {
        return null;
    }
    const c = clone.toLowerCase();
    if (c.includes("sp142")) {
        return "IC%";
    }
    if (c.includes("22c3")) {
        // 22C3 reports CPS in Gastric/TNBC context, TPS everywhere else it's
        // used (NSCLC/HNSCC/Cervical) - design guide Section 7, Algorithm E3.
        return (cancerType === "Gastric / GEJ" || isTnbc) ? "CPS" : "TPS";
    }
    if (c.includes("28-8") || c.includes("sp263")) {
        return "TPS";
    }
    return null;
}
// ---------------------------------------------------------------------------
// Algorithm E4 - Germline Referral Flag (split into Lynch syndrome detection
// and the broader referral flag, matching the two separate columns that
// actually exist on derived_fields: lynch_syndrome_flag, germline_referral_flag)
// ---------------------------------------------------------------------------
function deriveLynchSyndromeFlag(ihc, molecular) {
    if ((0, oncology_constants_1.isLost)(ihc.mmr_msh2)) {
        return true;
    }
    if ((0, oncology_constants_1.isLost)(ihc.mmr_msh6)) {
        return true;
    }
    if ((0, oncology_constants_1.isLost)(ihc.mmr_mlh1)) {
        // MLH1 loss reflexes to BRAF V600E + MLH1 methylation to distinguish
        // sporadic (BRAF+/methylated) from Lynch syndrome (both negative).
        const brafNegative = !(0, oncology_constants_1.isPositiveLike)(molecular.braf_v600e);
        const mlh1MethNegative = (ihc.mlh1_methylation ?? "").trim().toLowerCase() === "not methylated";
        if (brafNegative && mlh1MethNegative) {
            return true;
        }
    }
    return false;
}
const BRCA_REFERRAL_VALUES = ["pathogenic", "likely pathogenic", "variant of uncertain significance (vus)"];
function deriveGermlineReferralFlag(cancerType, molecular, lynchSyndromeFlag, patientAgeYears, params) {
    const brca1Flagged = BRCA_REFERRAL_VALUES.includes((molecular.brca1_germline ?? "").trim().toLowerCase());
    const brca2Flagged = BRCA_REFERRAL_VALUES.includes((molecular.brca2_germline ?? "").trim().toLowerCase());
    if (brca1Flagged || brca2Flagged) {
        return true;
    }
    if (lynchSyndromeFlag) {
        return true;
    }
    if (cancerType === "Ovarian") {
        return true;
    }
    if (cancerType === "Breast" && patientAgeYears !== null && patientAgeYears < params.tnbc_germline_referral_age_years) {
        return true;
    }
    return false;
}
// ---------------------------------------------------------------------------
// Suggested therapy - advisory text only, covering the specific cases the
// client's two documents actually document (Sheet 5's worked examples plus
// Sheet 7's stage-level guidance). This is NOT a general oncology decision
// engine; unmatched combinations return null rather than guessing, and every
// non-null string carries the "clinician confirmation required" disclaimer
// per the client's explicit requirement that this is advisory-only.
// ---------------------------------------------------------------------------
function deriveSuggestedTherapy(cancerType, staging, breastMolSubtype, ihc, molecular, params) {
    const CONFIRM = "Clinician confirmation required before any treatment order.";
    const stage = (staging.clinical_stage ?? "").toUpperCase();
    const isStage4 = stage.includes("IV");
    if (cancerType === "Breast" && breastMolSubtype) {
        if (breastMolSubtype === "Luminal B HER2+") {
            return isStage4
                ? `Advisory: Dual anti-HER2 blockade + chemotherapy; add CDK4/6 inhibitor + endocrine therapy for the HR+ component (NCCN Cat 1). ${CONFIRM}`
                : `Advisory: Neoadjuvant chemotherapy (AC-T) + Trastuzumab + Pertuzumab, dual HER2 blockade (NCCN Cat 1). ${CONFIRM}`;
        }
        if (breastMolSubtype === "HER2-Enriched") {
            return `Advisory: Neoadjuvant chemotherapy + Trastuzumab + Pertuzumab; residual disease -> T-DM1. ${CONFIRM}`;
        }
        if (breastMolSubtype === "TNBC") {
            return `Advisory: NACT (carboplatin + taxane + anthracycline); add pembrolizumab if PD-L1 CPS >= 10; BRCA+: consider adjuvant olaparib. ${CONFIRM}`;
        }
        if (breastMolSubtype === "Luminal A" || breastMolSubtype === "Luminal B HER2-") {
            return `Advisory: Endocrine therapy (Tamoxifen or AI) +/- CDK4/6 inhibitor; chemotherapy per multigene assay recurrence score. ${CONFIRM}`;
        }
        return null;
    }
    if (cancerType === "Lung") {
        if ((0, oncology_constants_1.isPositiveLike)(molecular.egfr_status)) {
            if (!molecular.egfr_mutation_type) {
                // V-08 already surfaces this as a warning - no therapy can be
                // suggested without knowing which mutation is present.
                return null;
            }
            const mutType = molecular.egfr_mutation_type.toLowerCase();
            if (mutType.includes("exon 19") || mutType.includes("l858r")) {
                return `Advisory: Osimertinib 80mg OD (FLAURA, NCCN Category 1). ${CONFIRM}`;
            }
            // T790M is a resistance mutation (typically acquired after a 1st/2nd-gen
            // EGFR TKI) rather than an exon 20 insertion, even though the enum label
            // also carries "(exon 20)" - checked before the generic exon 20 branch so
            // it doesn't fall through to the insertion-specific drugs below.
            if (mutType.includes("t790m")) {
                return `Advisory: Osimertinib 80mg OD (AURA3 - T790M-mediated resistance). ${CONFIRM}`;
            }
            if (mutType.includes("exon 20 insertion")) {
                return `Advisory: Amivantamab + chemotherapy, or Mobocertinib. ${CONFIRM}`;
            }
            return `Advisory: EGFR-directed TKI per specific mutation subtype - review current NCCN NSCLC guideline. ${CONFIRM}`;
        }
        if ((0, oncology_constants_1.isPositiveLike)(molecular.alk_status)) {
            return `Advisory: Alectinib or Lorlatinib (1L, preferred for CNS penetrance - CROWN trial). ${CONFIRM}`;
        }
        if (molecular.kras_g12c && (0, oncology_constants_1.isPositiveLike)(molecular.kras_g12c)) {
            return `Advisory: Sotorasib or Adagrasib (KRAS G12C). ${CONFIRM}`;
        }
        if (ihc.pdl1_tps != null && ihc.pdl1_tps >= params.pdl1_tps_high_cutoff_pct) {
            return `Advisory: Pembrolizumab monotherapy (PD-L1 TPS >= ${params.pdl1_tps_high_cutoff_pct}%, driver-negative). ${CONFIRM}`;
        }
        return null;
    }
    // No documented rule for this cancer type/subtype combination in the
    // client's two source documents - return null rather than fabricate one.
    return null;
}
// Orchestrates E1-E4 plus the ICD auto-fill copy-through. Deliberately
// synchronous and side-effect-free - all DB reads (clinical_parameter
// thresholds, subtype ICD codes, patient age) happen in the caller via
// OncologyRepository, so this function stays unit-testable without a DB.
function deriveOncologyFields(staging, ihc, molecular, context, params) {
    const her2Positive = deriveHer2Positive(ihc, params);
    const breastMolSubtype = deriveBreastMolecularSubtype(staging.cancer_type, ihc, params);
    const isTnbc = breastMolSubtype === "TNBC";
    const pdl1ScoreType = derivePdl1ScoreType(ihc.pdl1_clone, staging.cancer_type, isTnbc);
    const lynchSyndromeFlag = deriveLynchSyndromeFlag(ihc, molecular);
    const germlineReferralFlag = deriveGermlineReferralFlag(staging.cancer_type, molecular, lynchSyndromeFlag, context.patientAgeYears, params);
    const suggestedTherapy = deriveSuggestedTherapy(staging.cancer_type, staging, breastMolSubtype, ihc, molecular, params);
    return {
        breast_mol_subtype: breastMolSubtype,
        icd10_auto: context.icd10FromSubtype,
        icd_o3_auto: context.icdO3FromSubtype,
        // Clinician-entered clinical_stage is treated as authoritative rather
        // than re-derived from raw T/N/M - see plan doc conflict-resolution
        // note #5 (a full AJCC T+N+M lookup for 20 cancer groups isn't in
        // either source document).
        ajcc_stage: staging.clinical_stage ?? null,
        pdl1_score_type: pdl1ScoreType,
        her2_positive: her2Positive,
        lynch_syndrome_flag: lynchSyndromeFlag,
        germline_referral_flag: germlineReferralFlag,
        suggested_therapy: suggestedTherapy
    };
}
