import { IhcInput, MolecularInput, StagingInput, RuleViolation, ValidationResult } from "./oncology.types";
import { VALIDATION_RULE, isPositiveLike, isNotDoneOrPending, isLost, her2IhcScore } from "./oncology.constants";

// Design guide Section 5: V-01 through V-07 are hard blocks (server must
// return HTTP 422 with the full violation list, never just the first one).
// V-08 is a soft warning - save is allowed, but the caller must surface it.
// This is deliberately NOT express-validator - these are cross-field
// clinical rules evaluated together, not per-field request shape checks.
export function validateOncologyRecord(
    staging: StagingInput,
    ihc: IhcInput,
    molecular: MolecularInput
): ValidationResult {

    const hardErrors: RuleViolation[] = [];
    const warnings: RuleViolation[] = [];

    // V-01: HER2 IHC 2+ (Equivocal) requires a resolved FISH result before save.
    if (her2IhcScore(ihc.her2_ihc) === "2+" && isNotDoneOrPending(ihc.her2_fish)) {

        hardErrors.push({
            rule: VALIDATION_RULE.V01_HER2_FISH_REQUIRED,
            field: "her2_fish",
            message: "HER2 Equivocal (2+) - FISH result is mandatory before saving."
        });

    }

    // V-02: ER Positive requires ER%.
    if (isPositiveLike(ihc.er_status) && (ihc.er_percent === null || ihc.er_percent === undefined)) {

        hardErrors.push({
            rule: VALIDATION_RULE.V02_ER_PERCENT_REQUIRED,
            field: "er_percent",
            message: "ER% required when ER status is Positive (enter 1-100)."
        });

    }

    // V-03: PR Positive requires PR%.
    if (isPositiveLike(ihc.pr_status) && (ihc.pr_percent === null || ihc.pr_percent === undefined)) {

        hardErrors.push({
            rule: VALIDATION_RULE.V03_PR_PERCENT_REQUIRED,
            field: "pr_percent",
            message: "PR% required when PR status is Positive."
        });

    }

    // V-04: a PD-L1 clone was selected but no score was entered. SP142 reports
    // an IC score into pdl1_cps (0-3 scale) in this schema, everything else
    // reports into pdl1_tps - either counts as "a score was entered".
    if (ihc.pdl1_clone && !isNotDoneOrPending(ihc.pdl1_clone)) {

        const hasScore = (ihc.pdl1_tps !== null && ihc.pdl1_tps !== undefined)
            || (ihc.pdl1_cps !== null && ihc.pdl1_cps !== undefined);

        if (!hasScore) {

            hardErrors.push({
                rule: VALIDATION_RULE.V04_PDL1_SCORE_REQUIRED,
                field: "pdl1_tps",
                message: "PD-L1 score required when a clone is selected."
            });

        }

    }

    // V-05: Clinical Stage is always mandatory.
    if (!staging.clinical_stage) {

        hardErrors.push({
            rule: VALIDATION_RULE.V05_CLINICAL_STAGE_REQUIRED,
            field: "clinical_stage",
            message: "Clinical Stage is mandatory - cannot save without staging."
        });

    }

    // V-06: M1 (or any M1 sub-stage) requires at least one metastasis site.
    if ((staging.m_stage ?? "").trim().toUpperCase().startsWith("M1")) {

        if (!staging.metastasis_sites || staging.metastasis_sites.length === 0) {

            hardErrors.push({
                rule: VALIDATION_RULE.V06_METASTASIS_SITES_REQUIRED,
                field: "metastasis_sites",
                message: "Specify at least one metastasis site when M = M1."
            });

        }

    }

    // V-07: dMMR requires all four MMR antibody results.
    const isDmmr = (ihc.mmr_overall ?? "").trim().toLowerCase() === "dmmr";

    if (isDmmr) {

        const missing = (["mmr_mlh1", "mmr_msh2", "mmr_msh6", "mmr_pms2"] as const)
            .filter((field) => !ihc[field]);

        if (missing.length > 0) {

            hardErrors.push({
                rule: VALIDATION_RULE.V07_MMR_PANEL_REQUIRED,
                field: missing.join(", "),
                message: "All four MMR antibody results required when dMMR is selected."
            });

        }

    }

    // V-08: EGFR Positive without a mutation type - soft warning only, save proceeds.
    if (isPositiveLike(molecular.egfr_status) && !molecular.egfr_mutation_type) {

        warnings.push({
            rule: VALIDATION_RULE.V08_EGFR_MUTATION_TYPE_SOFT,
            field: "egfr_mutation_type",
            message: "EGFR mutation type not entered - this affects drug choice. Please enter before prescribing."
        });

    }

    return { hardErrors, warnings };

}

// isLost is re-exported for the derivation module's Lynch-syndrome check,
// which needs the same "Lost" comparison against the MMR panel.
export { isLost };
