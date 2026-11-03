// Consultation Summary reference lists. Diet types are not a DB master table
// (patient_personal_history.diet_type stores the selected value directly), so
// they live here as the canonical option list.
export const DIET_TYPES = [
    "Vegetarian",
    "Eggetarian",
    "Non-Vegetarian",
    "Vegan",
    "Jain",
    "Gluten-Free",
    "Diabetic",
    "Low-Salt"
];

export const REPORT_FIELD_MAX = 2000;

// Consultation > Personal History > Family History.
// Degrees are fixed by the form (1st / 2nd / 3rd) and relative types are not a
// DB master table, so both lists live here as the canonical options. A
// relative type typed by hand is still saved on the encounter row; `degree`
// is only an auto-suggest default the doctor can override.
export type FamilyDegree = "1st" | "2nd" | "3rd";

export interface RelativeTypeOption {
    name: string;
    degree: FamilyDegree | null;
}

export const FAMILY_DEGREES: FamilyDegree[] = ["1st", "2nd", "3rd"];

export const RELATIVE_TYPES: RelativeTypeOption[] = [
    // 1st degree (parents, siblings, children)
    { name: "Mother", degree: "1st" },
    { name: "Father", degree: "1st" },
    { name: "Sister", degree: "1st" },
    { name: "Brother", degree: "1st" },
    { name: "Daughter", degree: "1st" },
    { name: "Son", degree: "1st" },
    { name: "Half-Sister", degree: "1st" },
    { name: "Half-Brother", degree: "1st" },

    // 2nd degree (grandparents, aunts/uncles, grandchildren, nieces/nephews)
    { name: "Grandmother (Maternal)", degree: "2nd" },
    { name: "Grandfather (Maternal)", degree: "2nd" },
    { name: "Grandmother (Paternal)", degree: "2nd" },
    { name: "Grandfather (Paternal)", degree: "2nd" },
    { name: "Aunt (Maternal)", degree: "2nd" },
    { name: "Uncle (Maternal)", degree: "2nd" },
    { name: "Aunt (Paternal)", degree: "2nd" },
    { name: "Uncle (Paternal)", degree: "2nd" },
    { name: "Granddaughter", degree: "2nd" },
    { name: "Grandson", degree: "2nd" },
    { name: "Niece", degree: "2nd" },
    { name: "Nephew", degree: "2nd" },

    // 3rd degree (cousins, great-grandparents, great-aunts/uncles)
    { name: "Cousin (Maternal)", degree: "3rd" },
    { name: "Cousin (Paternal)", degree: "3rd" },
    { name: "Great-Grandmother", degree: "3rd" },
    { name: "Great-Grandfather", degree: "3rd" },
    { name: "Great-Aunt", degree: "3rd" },
    { name: "Great-Uncle", degree: "3rd" },
    { name: "First Cousin Once Removed", degree: "3rd" },

    // Non-blood relatives - degree is intentionally left for the doctor to pick.
    { name: "Spouse", degree: null },
    { name: "Husband", degree: null },
    { name: "Wife", degree: null },
    { name: "Adopted Child", degree: null },
    { name: "Adopted Parent", degree: null },
    { name: "Step-Mother", degree: null },
    { name: "Step-Father", degree: null },
    { name: "Step-Sister", degree: null },
    { name: "Step-Brother", degree: null },
    { name: "Mother-in-law", degree: null },
    { name: "Father-in-law", degree: null },
    { name: "Sister-in-law", degree: null },
    { name: "Brother-in-law", degree: null },
    { name: "Daughter-in-law", degree: null },
    { name: "Son-in-law", degree: null },
    { name: "Guardian", degree: null },
    { name: "Other", degree: null }
];

// Consultation > Patient Details > Molecular Testing options (moved from the
// Diagnosis tab). A test not listed here is typed by hand and saved on the
// patient's encounter_molecular_test row only.
export const MOLECULAR_TESTS = [
    "PCR / RT-PCR",
    "NGS (Next-Generation Sequencing)",
    "FISH",
    "ISH / CISH",
    "IHC",
    "Liquid biopsy / ctDNA",
    "Gene-expression profiling",
    "MSI / MMR testing",
    "TMB testing",
    "BRCA1/BRCA2 and HRR testing"
];

// General Examination findings stored as their own boolean columns on
// encounter; general_examination_master only holds the extra findings
// doctors add, so these names can't be added there again.
export const GENERAL_EXAMINATION_CORE_FINDINGS = [
    "Icterus",
    "Pallor",
    "Clubbing",
    "Cyanosis",
    "Oedema",
    "Lymphadenopathy"
];
