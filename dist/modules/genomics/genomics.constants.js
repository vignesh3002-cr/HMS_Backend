"use strict";
// Genomic Data Capture constants. The UI shows friendly labels; the API and
// database use the enum values from the developer specification.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DELETE_REASON_LENGTH = exports.MAX_GENE_SYMBOL_LENGTH = exports.MAX_PANEL_NAME_LENGTH = exports.MAX_LAB_NAME_LENGTH = exports.MAX_TRANSCRIPT_LENGTH = exports.MAX_REMARKS_LENGTH = exports.SAMPLE_TYPE_TO_SCOPE = exports.STATUS_LABELS = exports.SAMPLE_TYPE_LABELS = exports.GENOMIC_SCOPES = exports.GENOMIC_STATUSES = exports.GENOMIC_SAMPLE_TYPES = void 0;
exports.GENOMIC_SAMPLE_TYPES = ["LIQUID_BIOPSY", "TISSUE", "GERMLINE"];
exports.GENOMIC_STATUSES = ["PRESENT", "ABSENT", "VUS"];
exports.GENOMIC_SCOPES = ["SOMATIC", "GERMLINE"];
exports.SAMPLE_TYPE_LABELS = {
    LIQUID_BIOPSY: "Liquid biopsy",
    TISSUE: "Tissue",
    GERMLINE: "Germline",
};
exports.STATUS_LABELS = {
    PRESENT: "Present",
    ABSENT: "Absent",
    VUS: "VUS",
};
// Liquid biopsy and Tissue are tumour tests -> somatic gene list.
// Germline is the inherited list.
exports.SAMPLE_TYPE_TO_SCOPE = {
    LIQUID_BIOPSY: "SOMATIC",
    TISSUE: "SOMATIC",
    GERMLINE: "GERMLINE",
};
exports.MAX_REMARKS_LENGTH = 1000;
exports.MAX_TRANSCRIPT_LENGTH = 500;
exports.MAX_LAB_NAME_LENGTH = 200;
exports.MAX_PANEL_NAME_LENGTH = 200;
exports.MAX_GENE_SYMBOL_LENGTH = 50;
exports.MAX_DELETE_REASON_LENGTH = 500;
