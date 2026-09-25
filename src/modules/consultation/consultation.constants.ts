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
