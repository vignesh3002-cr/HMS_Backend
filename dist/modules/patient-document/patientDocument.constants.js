"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCUMENT_TYPE_VALUES = exports.DOCUMENT_TYPE = void 0;
// Free-text taxonomy for patient_document.document_type -- validated here at
// the app layer, the same way category already is (no DB CHECK constraint,
// consistent with every other classification column in this schema).
exports.DOCUMENT_TYPE = {
    BIOPSY_REPORT: "BIOPSY_REPORT",
    DISCHARGE_DOCUMENT: "DISCHARGE_DOCUMENT",
    LAB_REPORT: "LAB_REPORT",
    IMAGING: "IMAGING",
    CONSENT_FORM: "CONSENT_FORM",
    INSURANCE: "INSURANCE",
    OTHER: "OTHER",
};
exports.DOCUMENT_TYPE_VALUES = Object.values(exports.DOCUMENT_TYPE);
