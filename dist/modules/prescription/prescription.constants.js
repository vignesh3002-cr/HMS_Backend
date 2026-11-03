"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BEFORE_AFTER_FOOD_VALUES = exports.ROUTE_OF_ADMINISTRATION_VALUES = exports.PRESCRIPTION_TYPE_VALUES = exports.PRESCRIPTION_TYPE = exports.PRESCRIPTION_STATUS_VALUES = exports.PRESCRIPTION_STATUS = void 0;
exports.PRESCRIPTION_STATUS = {
    DRAFT: "DRAFT",
    FINALIZED: "FINALIZED",
    CANCELLED: "CANCELLED"
};
exports.PRESCRIPTION_STATUS_VALUES = Object.values(exports.PRESCRIPTION_STATUS);
// A visit can legitimately have two prescriptions: the medicines prescribed
// in the Advice section, and the chemotherapy plan's medicines (same day,
// same encounter).
exports.PRESCRIPTION_TYPE = {
    ADVICE: "ADVICE",
    CHEMOTHERAPY: "CHEMOTHERAPY",
    GENERAL: "GENERAL"
};
exports.PRESCRIPTION_TYPE_VALUES = Object.values(exports.PRESCRIPTION_TYPE);
exports.ROUTE_OF_ADMINISTRATION_VALUES = [
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
exports.BEFORE_AFTER_FOOD_VALUES = ["Before Food", "After Food", "With Food"];
