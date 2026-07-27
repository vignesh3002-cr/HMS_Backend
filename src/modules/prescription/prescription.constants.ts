export const PRESCRIPTION_STATUS = {
    DRAFT: "DRAFT",
    FINALIZED: "FINALIZED",
    CANCELLED: "CANCELLED"
} as const;

export const PRESCRIPTION_STATUS_VALUES: string[] = Object.values(PRESCRIPTION_STATUS);

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
