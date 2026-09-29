"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERAL_EXAMINATION_CORE_FINDINGS = exports.MOLECULAR_TESTS = exports.REPORT_FIELD_MAX = exports.DIET_TYPES = void 0;
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
// Consultation > Patient Details > Molecular Testing options (moved from the
// Diagnosis tab). A test not listed here is typed by hand and saved on the
// patient's encounter_molecular_test row only.
exports.MOLECULAR_TESTS = [
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
exports.GENERAL_EXAMINATION_CORE_FINDINGS = [
    "Icterus",
    "Pallor",
    "Clubbing",
    "Cyanosis",
    "Oedema",
    "Lymphadenopathy"
];
