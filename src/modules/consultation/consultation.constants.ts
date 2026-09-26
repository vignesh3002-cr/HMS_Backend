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
