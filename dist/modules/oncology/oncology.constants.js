"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALIDATION_RULE = exports.LATERALITY_CANCER_TYPES = exports.MOLECULAR_BLOCK_CANCER_TYPES = exports.IHC_BLOCK_CANCER_TYPES = exports.ENCOUNTER_RECENCY_WINDOW_DAYS = exports.ENCOUNTER_OPEN_STATUS = void 0;
exports.isPositiveLike = isPositiveLike;
exports.isNotDoneOrPending = isNotDoneOrPending;
exports.isLost = isLost;
exports.her2IhcScore = her2IhcScore;
// A staging detail can only be created against a patient who has actually
// been seen: their most recent encounter must either be currently OPEN, or
// closed but still within this recency window (e.g. a biopsy/pathology
// report coming back after the visit that ordered it has already closed).
// Older than this, the caller should open a fresh encounter instead.
exports.ENCOUNTER_OPEN_STATUS = "OPEN";
exports.ENCOUNTER_RECENCY_WINDOW_DAYS = 30;
// Cancer types where the IHC block (Block C) is shown, per design guide
// Section 6.1 Step 3 / Section 8's Block C trigger.
exports.IHC_BLOCK_CANCER_TYPES = [
    "Breast", "Gastric / GEJ", "Cervical", "Colorectal", "Thyroid", "Bladder", "Endometrial"
];
// Cancer types where the Molecular/NGS block (Block D) is shown, per
// Section 6.1 Step 4 / Section 8's Block D trigger. Breast is added
// separately only when HER2+ or TNBC (checked at call time, not by type name
// alone - see oncology.derivation.ts).
exports.MOLECULAR_BLOCK_CANCER_TYPES = [
    "Lung", "Colorectal", "Melanoma", "Thyroid"
];
// Cancer types where Laterality is shown, per Section 6.2.
exports.LATERALITY_CANCER_TYPES = [
    "Breast", "Kidney", "Lung", "Ovarian", "Prostate"
];
exports.VALIDATION_RULE = {
    V01_HER2_FISH_REQUIRED: "V-01",
    V02_ER_PERCENT_REQUIRED: "V-02",
    V03_PR_PERCENT_REQUIRED: "V-03",
    V04_PDL1_SCORE_REQUIRED: "V-04",
    V05_CLINICAL_STAGE_REQUIRED: "V-05",
    V06_METASTASIS_SITES_REQUIRED: "V-06",
    V07_MMR_PANEL_REQUIRED: "V-07",
    V08_EGFR_MUTATION_TYPE_SOFT: "V-08"
};
// A small set of string synonyms this system accepts for the same clinical
// meaning, since the two source documents (and even different sheets within
// the client's spreadsheet) don't always agree on exact enum wording
// ("Positive" vs "Mutation Detected" vs "Detected" for the same result).
function isPositiveLike(value) {
    if (!value) {
        return false;
    }
    const v = value.trim().toLowerCase();
    return v.startsWith("positive")
        || v === "detected"
        || v === "fusion detected"
        || v === "mutation detected"
        || v.startsWith("amplified")
        || v.startsWith("pathogenic")
        || v.startsWith("likely pathogenic")
        || v.startsWith("v600e detected")
        || v === "yes";
}
function isNotDoneOrPending(value) {
    if (!value) {
        return true;
    }
    const v = value.trim().toLowerCase();
    return v === "not done" || v === "pending" || v === "";
}
function isLost(value) {
    return (value ?? "").trim().toLowerCase() === "lost";
}
// HER2 IHC scores are stored with an optional trailing label
// ("2+" or "2+ (Equivocal)") - compare on the leading token only.
function her2IhcScore(value) {
    if (!value) {
        return null;
    }
    const match = value.trim().match(/^\d\+?/);
    return match ? match[0] : null;
}
