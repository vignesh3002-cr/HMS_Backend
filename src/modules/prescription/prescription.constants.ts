export const PRESCRIPTION_STATUS = {
    DRAFT: "DRAFT",
    FINALIZED: "FINALIZED",
    CANCELLED: "CANCELLED"
} as const;

export const PRESCRIPTION_STATUS_VALUES = Object.values(PRESCRIPTION_STATUS);

// A visit can legitimately have two prescriptions: the medicines prescribed
// in the Advice section, and the chemotherapy plan's medicines (same day,
// same encounter).
export const PRESCRIPTION_TYPE = {
    ADVICE: "ADVICE",
    CHEMOTHERAPY: "CHEMOTHERAPY",
    GENERAL: "GENERAL"
} as const;

export const PRESCRIPTION_TYPE_VALUES = Object.values(PRESCRIPTION_TYPE);

export const ROUTE_OF_ADMINISTRATION_VALUES = [
    "Oral",
    "IV",
    "IM",
    "Topical",
    "Subcutaneous",
    "Inhalation",
    "Sublingual",
    "Rectal",
    "Ophthalmic",
    "Otic",
    "Nasal"
];

export const BEFORE_AFTER_FOOD_VALUES = ["Before Food", "After Food", "With Food"];
