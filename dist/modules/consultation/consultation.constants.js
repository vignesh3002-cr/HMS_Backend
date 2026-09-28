"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_FIELD_MAX = exports.DIET_TYPES = void 0;
// Consultation Summary reference lists. Diet types are not a DB master table
// (patient_personal_history.diet_type stores the selected value directly), so
// they live here as the canonical option list.
exports.DIET_TYPES = [
    "Vegetarian",
    "Eggetarian",
    "Non-Vegetarian",
    "Vegan",
    "Jain",
    "Gluten-Free",
    "Diabetic",
    "Low-Salt"
];
exports.REPORT_FIELD_MAX = 2000;
