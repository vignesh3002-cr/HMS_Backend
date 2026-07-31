"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Object.defineProperty(exports, "__esModule", { value: true });
exports.BEFORE_AFTER_FOOD_VALUES = exports.ROUTE_OF_ADMINISTRATION_VALUES = exports.PRESCRIPTION_STATUS_VALUES = exports.PRESCRIPTION_STATUS = void 0;
exports.PRESCRIPTION_STATUS = {
    DRAFT: "DRAFT",
    FINALIZED: "FINALIZED",
    CANCELLED: "CANCELLED"
};
exports.PRESCRIPTION_STATUS_VALUES = Object.values(exports.PRESCRIPTION_STATUS);
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
