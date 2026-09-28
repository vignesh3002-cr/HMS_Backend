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
